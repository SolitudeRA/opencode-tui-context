// Exercise an unpacked release in a real, isolated OpenCode TUI, without a model request.
// Requires an interactive terminal. On Windows, pass the path to opencode.exe.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const match = /^--(package|opencode)=(.+)$/.exec(arg)
  assert(match, "Usage: node scripts/smoke-host.mjs --package=<unpacked-package> [--opencode=<executable>]")
  return [match[1], match[2]]
}))
assert(args.package, "--package=<unpacked-package> is required")
assert(process.stdin.isTTY && process.stdout.isTTY, "Run this smoke check in an interactive terminal (TTY)")
const input = path.resolve(args.package)
const manifest = JSON.parse(await readFile(path.join(input, "package.json"), "utf8"))
assert.equal(manifest.name, "opencode-tui-context")
assert.equal(manifest.exports?.["./tui"]?.import, "./dist/tui.js")
const bundle = await readFile(path.join(input, "dist", "tui.js"))
assert(bundle.length > 0)
const bundleSha256 = createHash("sha256").update(bundle).digest("hex")

async function checkPackage(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), `Release must not contain symbolic links: ${entry.name}`)
    if (!entry.isDirectory()) continue
    assert.notEqual(entry.name, "node_modules", "Use an unpacked release without node_modules")
    await checkPackage(path.join(dir, entry.name))
  }
}
await checkPackage(input)

const root = await mkdtemp(path.join(os.tmpdir(), "opencode-tui-context-host-"))
const locations = Object.fromEntries(["package", "home", "config", "data", "cache", "state", "tmp", "managed", "project"].map((name) => [name, path.join(root, name)]))
await Promise.all(Object.values(locations).map((dir) => mkdir(dir, { recursive: true })))
// Copy the exact package contents away from the repository's development dependencies.
await cp(input, locations.package, { recursive: true })
for (let dir = locations.package; ; dir = path.dirname(dir)) {
  const children = await readdir(dir)
  assert(!children.includes("node_modules"), `A node_modules directory could mask missing host dependencies: ${dir}`)
  if (dir === path.dirname(dir)) break
}

const evidencePath = path.join(root, "host-evidence.json")
const probePath = path.join(root, "observer.mjs")
const targetSpec = pathToFileURL(locations.package + path.sep).href
await writeFile(probePath, `import { writeFile } from "node:fs/promises"
export default {
  id: "opencode-tui-context-host-observer",
  async tui(api) {
    const timer = setTimeout(async () => {
      const target = api.plugins.list().find((item) => item.id === "opencode-tui-context")
      const evidence = {
        hostVersion: api.app.version,
        packageVersion: ${JSON.stringify(manifest.version)},
        bundleSha256: ${JSON.stringify(bundleSha256)},
        target,
        frameId: api.renderer.frameId,
        route: api.route.current.name,
        verifiedAt: new Date().toISOString(),
        scope: "Real host import, initialization, and active status; no model request or session panel interaction"
      }
      await writeFile(${JSON.stringify(evidencePath)}, JSON.stringify(evidence, null, 2) + "\\n")
      api.keymap.dispatchCommand("app.exit")
    }, 1500)
    api.lifecycle.onDispose(() => clearTimeout(timer))
  }
}
`)
const configDir = path.join(locations.config, "opencode")
await mkdir(configDir, { recursive: true })
const tuiConfig = path.join(configDir, "tui.json")
const serverConfig = path.join(configDir, "opencode.json")
await writeFile(tuiConfig, JSON.stringify({ plugin: [targetSpec, pathToFileURL(probePath).href] }, null, 2))
await writeFile(serverConfig, JSON.stringify({ autoupdate: false, enabled_providers: [], permission: "deny" }, null, 2))
const npmConfig = path.join(root, "empty.npmrc")
await writeFile(npmConfig, "")

// Inherit only process/terminal essentials; do not forward credentials or user OpenCode overrides.
const inherited = new Set(["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TERM", "COLORTERM", "LANG", "LC_ALL", "LC_CTYPE"])
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => inherited.has(key.toUpperCase())))
Object.assign(env, {
  XDG_CONFIG_HOME: locations.config,
  XDG_DATA_HOME: locations.data,
  XDG_CACHE_HOME: locations.cache,
  XDG_STATE_HOME: locations.state,
  OPENCODE_TEST_HOME: locations.home,
  OPENCODE_TEST_MANAGED_CONFIG_DIR: locations.managed,
  OPENCODE_CONFIG: serverConfig,
  OPENCODE_TUI_CONFIG: tuiConfig,
  OPENCODE_DISABLE_PROJECT_CONFIG: "1",
  OPENCODE_DISABLE_AUTOUPDATE: "1",
  OPENCODE_DISABLE_MODELS_FETCH: "1",
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: "1",
  OPENCODE_DISABLE_TERMINAL_TITLE: "1",
  // The host uses @npmcli/config for background dependency installation; XDG alone
  // does not isolate its user .npmrc or npm cache.
  npm_config_userconfig: npmConfig,
  npm_config_globalconfig: npmConfig,
  npm_config_cache: path.join(locations.cache, "npm"),
  npm_config_registry: "https://registry.npmjs.org/",
  npm_config_update_notifier: "false",
  npm_config_audit: "false",
  npm_config_fund: "false",
  TMP: locations.tmp,
  TEMP: locations.tmp,
  TMPDIR: locations.tmp,
})
const executable = args.opencode ?? (process.platform === "win32" ? "opencode.exe" : "opencode")
console.log(`Isolated host smoke artifacts: ${root}`)
const child = spawn(executable, [locations.project, "--log-level", "DEBUG"], { cwd: locations.project, env, stdio: "inherit" })
let timedOut = false
const timer = setTimeout(() => {
  timedOut = true
  child.kill()
}, 45000)
let code
try {
  code = await new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", resolve)
  })
} finally {
  clearTimeout(timer)
}
assert(!timedOut, `OpenCode timed out; inspect ${root}`)
assert.equal(code, 0, `OpenCode failed; inspect ${root}`)
const evidence = JSON.parse(await readFile(evidencePath, "utf8"))
assert.equal(evidence.target?.id, manifest.name)
assert.equal(evidence.target?.spec, targetSpec)
assert.equal(evidence.target?.enabled, true)
assert.equal(evidence.target?.active, true)
assert(evidence.frameId > 0, "Host initialized but did not render a frame")
console.log(`PASS: OpenCode ${evidence.hostVersion} loaded ${manifest.name}@${manifest.version} from the unpacked release.`)
console.log(`Evidence: ${evidencePath}`)
console.log("Scope: module import, initialization, and active status. Session panel appearance and live token updates require separate acceptance.")
