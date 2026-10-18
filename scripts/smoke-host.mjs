// Real OpenCode V2 acceptance with synthetic sessions; no model requests or user configuration.
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
const executable = args.opencode ? path.resolve(args.opencode) : process.platform === "win32" ? "opencode.exe" : "opencode"
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
const root = await mkdtemp(path.join(os.tmpdir(), "opencode-tui-context-v2-host-"))
const locations = Object.fromEntries(["package", "home", "config", "data", "cache", "state", "tmp", "managed", "project"].map((name) => [name, path.join(root, name)]))
await Promise.all(Object.values(locations).map((dir) => mkdir(dir, { recursive: true })))
await cp(input, locations.package, { recursive: true })
for (let dir = locations.package; ; dir = path.dirname(dir)) {
  assert(!(await readdir(dir)).includes("node_modules"), `Development dependencies could mask missing host dependencies: ${dir}`)
  if (dir === path.dirname(dir)) break
}
const configDir = path.join(locations.config, "opencode")
await mkdir(configDir, { recursive: true })
const cliConfig = path.join(configDir, "cli.json")
const evidencePath = path.join(root, "host-evidence.json")
const probeDir = path.join(root, "observer")
await mkdir(probeDir)
const probePath = path.join(probeDir, "tui.js")
await writeFile(path.join(probeDir, "package.json"), JSON.stringify({ name: "opencode-tui-context-host-observer", type: "module", exports: { "./tui": "./tui.js" } }))
const targetSpec = pathToFileURL(locations.package + path.sep).href
const npmConfig = path.join(root, "empty.npmrc")
await writeFile(npmConfig, "")
const inherited = new Set(["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TERM", "COLORTERM", "LANG", "LC_ALL", "LC_CTYPE"])
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => inherited.has(key.toUpperCase())))
Object.assign(env, {
  HOME: locations.home, USERPROFILE: locations.home,
  XDG_CONFIG_HOME: locations.config, XDG_DATA_HOME: locations.data,
  XDG_CACHE_HOME: locations.cache, XDG_STATE_HOME: locations.state,
  OPENCODE_TEST_HOME: locations.home, OPENCODE_CONFIG_DIR: configDir,
  OPENCODE_TEST_MANAGED_CONFIG_DIR: locations.managed,
  OPENCODE_DISABLE_AUTOUPDATE: "1", OPENCODE_DISABLE_MODELS_FETCH: "1",
  npm_config_userconfig: npmConfig, npm_config_globalconfig: npmConfig,
  npm_config_cache: path.join(locations.cache, "npm"), npm_config_registry: "https://registry.npmjs.org/",
  npm_config_update_notifier: "false", npm_config_audit: "false", npm_config_fund: "false",
  TMP: locations.tmp, TEMP: locations.tmp, TMPDIR: locations.tmp,
})
async function execute(commandArgs, label, terminal = false) {
  const child = spawn(executable, commandArgs, { cwd: locations.project, env, stdio: terminal ? "inherit" : ["ignore", "pipe", "pipe"] })
  let stdout = "", stderr = "", timedOut = false
  if (!terminal) {
    child.stdout.setEncoding("utf8").on("data", (chunk) => { stdout += chunk })
    child.stderr.setEncoding("utf8").on("data", (chunk) => { stderr += chunk })
  }
  const timer = setTimeout(() => { timedOut = true; child.kill() }, 90000)
  let code
  try {
    code = await new Promise((resolve, reject) => { child.once("error", reject); child.once("close", resolve) })
  } finally {
    clearTimeout(timer)
    if (!terminal) {
      await writeFile(path.join(root, `${label}.stdout.txt`), stdout)
      await writeFile(path.join(root, `${label}.stderr.txt`), stderr)
    }
  }
  assert(!timedOut, `Host ${label} timed out; inspect ${root}`)
  assert.equal(code, 0, `Host ${label} failed; inspect ${root}: ${stderr}`)
  return stdout
}
console.log(`Isolated V2 host smoke artifacts: ${root}`)
const hostVersion = (await execute(["--version"], "version")).trim().replace(/^opencode v/, "")
assert.match(hostVersion, /^2\./, "This check requires OpenCode V2")
const timestamp = Date.now()
const tokens = { input: 1000, output: 200, reasoning: 100, cache: { read: 600, write: 100 } }
const zeroTokens = { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
const model = { providerID: "host-smoke", id: "synthetic" }
await writeFile(path.join(configDir, "opencode.json"), JSON.stringify({ providers: { "host-smoke": {
  name: "Host smoke", package: "@opencode/ai/providers/openai-compatible",
  settings: { baseURL: "http://127.0.0.1:1/v1" },
  models: { synthetic: { name: "Synthetic", limit: { context: 10000, output: 1000 } } },
} } }))
const assistant = (id, counts = tokens) => ({ id, type: "assistant", agent: "build", model, content: [{ type: "text", text: "Synthetic host acceptance fixture. No model was called." }], tokens: counts, cost: 0, finish: "stop", time: { created: timestamp, completed: timestamp + 1 } })
const fixture = (name, messages, extra = {}) => ({
  info: { id: `ses_host_smoke_${name}`, projectID: "global", location: { directory: locations.project }, title: `Host smoke: ${name}`, cost: 0, tokens: zeroTokens, time: { created: timestamp, updated: timestamp }, ...extra },
  messages,
})
const cases = [
  { name: "snapshot", value: fixture("snapshot", [assistant("msg_01")]), expected: "20% used" },
  { name: "empty", value: fixture("empty", []), expected: "no usage snapshot yet" },
  { name: "revert", value: fixture("revert", [assistant("msg_revert01"), assistant("msg_revert02", { ...tokens, input: 9000 })]), expected: "20% used" },
]
for (const item of cases) {
  const fixturePath = path.join(root, `fixture-${item.name}.json`)
  await writeFile(fixturePath, JSON.stringify(item.value))
  await execute(["session", "import", fixturePath, "--directory", locations.project, "--standalone"], `import-${item.name}`)
}
const cliSettings = { plugins: [targetSpec, pathToFileURL(probeDir + path.sep).href], highlights: false }
await writeFile(cliConfig, JSON.stringify(cliSettings))
await writeFile(probePath, `import { writeFile } from "node:fs/promises"
import { Plugin } from "@opencode/plugin/tui"
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function descendants(node) { return [node, ...(node.getChildren?.() ?? []).flatMap(descendants)] }
function snapshot(renderer) {
  const panel = descendants(renderer.root).find((node) => node.id === "opencode-tui-context-panel")
  if (!panel) return undefined
  return { width: panel.width, height: panel.height, text: descendants(panel).flatMap((node) => typeof node.plainText === "string" ? [node.plainText] : []), nodes: descendants(panel).map((node) => ({ id: node.id, x: node.x, width: node.width, visible: node.visible })) }
}
async function until(read, test, label) {
  for (let index = 0; index < 120; index++) { const value = read(); if (test(value)) return value; await wait(100) }
  throw new Error("Timed out: " + label + " last=" + JSON.stringify(read()))
}
export default Plugin.define({
  id: "opencode-tui-context-host-observer",
  setup(context) {
    let cancelled = false
    const evidence = { hostVersion: context.app.version, packageVersion: ${JSON.stringify(manifest.version)}, bundleSha256: ${JSON.stringify(bundleSha256)}, cases: [], scope: "Real V2 package loading, synthetic session rendering, resize and plugin configuration reload; no model request" }
    const run = async () => {
      await wait(1000)
      context.renderer.resize(160, 48)
      for (const item of ${JSON.stringify(cases.map(({ name, value, expected }) => ({ name, sessionID: value.info.id, expected })))}) {
        if (cancelled) return
        // Import deliberately clears undo state. Exercise the real V2 revert API
        // after import, without restoring files in the isolated project.
        if (item.name === "revert") await context.client.session.revert.stage({ sessionID: item.sessionID, messageID: "msg_revert02", files: false })
        await context.data.session.sync(item.sessionID)
        await context.data.session.message.sync(item.sessionID)
        if (item.name === "revert") await until(() => context.data.session.get(item.sessionID), (session) => session?.revert?.messageID === "msg_revert02", "revert state is synchronized")
        context.ui.router.navigate({ type: "session", sessionID: item.sessionID })
        const panel = await until(() => snapshot(context.renderer), (value) => value?.text.some((text) => text.includes(item.expected)), item.name)
        // Capture values now: live Solid store references change again on unrevert.
        evidence.cases.push(JSON.parse(JSON.stringify({ name: item.name, panel, session: context.data.session.get(item.sessionID), messages: context.data.session.message.list(item.sessionID) })))
        if (item.name === "revert") {
          await context.client.session.revert.clear({ sessionID: item.sessionID })
          await context.data.session.sync(item.sessionID)
          evidence.unreverted = await until(() => snapshot(context.renderer), (value) => value?.text.includes("100% used"), "clear revert refreshes panel")
        }
      }
      context.ui.router.navigate({ type: "session", sessionID: ${JSON.stringify(cases[0].value.info.id)} })
      await until(() => snapshot(context.renderer), (value) => value?.text.includes("20% used"), "return to snapshot")
      context.renderer.resize(120, 40)
      await until(() => snapshot(context.renderer), (value) => value === undefined, "host hides sidebar in narrow terminal")
      evidence.sidebarHiddenAt120 = true
      context.renderer.resize(160, 48)
      evidence.restoredAt160 = await until(() => snapshot(context.renderer), (value) => value?.text.includes("20% used"), "wide terminal restores sidebar")
      await writeFile(${JSON.stringify(cliConfig)}, JSON.stringify({ ...${JSON.stringify(cliSettings)}, plugins: [...${JSON.stringify(cliSettings.plugins)}, "-opencode-tui-context"] }))
      await until(() => snapshot(context.renderer), (value) => value === undefined, "disable plugin removes panel")
      evidence.disabled = true
      await writeFile(${JSON.stringify(cliConfig)}, JSON.stringify(${JSON.stringify(cliSettings)}))
      evidence.reenabled = await until(() => snapshot(context.renderer), (value) => value?.text.includes("20% used"), "re-enable plugin restores panel")
      evidence.frameId = context.renderer.frameId
      evidence.verifiedAt = new Date().toISOString()
      evidence.passed = true
    }
    run().catch((error) => { evidence.error = String(error?.stack ?? error) }).finally(async () => {
      await writeFile(${JSON.stringify(evidencePath)}, JSON.stringify(evidence, null, 2))
      context.keymap.dispatch("app.exit")
    })
    return () => { cancelled = true }
  },
})
`)
await execute([locations.project, "--standalone"], "tui", true)
const evidence = JSON.parse(await readFile(evidencePath, "utf8"))
assert.equal(evidence.passed, true, evidence.error ?? `Host acceptance failed; inspect ${evidencePath}`)
assert(evidence.frameId > 0, "Real host must render a frame")
assert.equal(evidence.disabled, true)
assert.equal(evidence.sidebarHiddenAt120, true)
assert(evidence.restoredAt160)
assert(evidence.reenabled)
console.log(`PASS: OpenCode ${hostVersion} rendered ${manifest.name}@${manifest.version}, switched synthetic sessions, resized, disabled and re-enabled the plugin.`)
console.log(`Evidence: ${evidencePath}`)
console.log("Scope: isolated terminal host with synthetic token data. This does not call or certify any external model provider.")
