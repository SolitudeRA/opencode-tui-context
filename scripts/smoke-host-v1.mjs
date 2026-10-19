// Exercise the packed dual-API release in a real isolated OpenCode V1 TUI.
// Synthetic sessions and a loopback-only provider avoid any model requests.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const match = /^--(package|opencode)=(.+)$/.exec(arg)
  assert(match, "Usage: node scripts/smoke-host-v1.mjs --package=<unpacked-package> [--opencode=<executable>]")
  return [match[1], match[2]]
}))
assert(args.package, "--package=<unpacked-package> is required")
assert(process.stdin.isTTY && process.stdout.isTTY, "Run this smoke check in an interactive terminal (TTY)")
const input = path.resolve(args.package)
const executable = args.opencode ? path.resolve(args.opencode) : process.platform === "win32" ? "opencode.exe" : "opencode"
const manifest = JSON.parse(await readFile(path.join(input, "package.json"), "utf8"))
assert.equal(manifest.name, "opencode-tui-context")
assert.equal(manifest.exports?.["./tui"]?.import, "./dist/tui.js")
const bundleHashes = Object.fromEntries(await Promise.all(["tui.js", "tui-v1.js", "tui-v2.js"].map(async (file) => {
  const bundle = await readFile(path.join(input, "dist", file))
  assert(bundle.length > 0)
  return [file, createHash("sha256").update(bundle).digest("hex")]
})))
async function checkPackage(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), `Release must not contain symbolic links: ${entry.name}`)
    if (!entry.isDirectory()) continue
    assert.notEqual(entry.name, "node_modules", "Use an unpacked release without node_modules")
    await checkPackage(path.join(dir, entry.name))
  }
}
await checkPackage(input)
const root = await mkdtemp(path.join(os.tmpdir(), "opencode-tui-context-v1-host-"))
const locations = Object.fromEntries(["package", "home", "config", "data", "cache", "state", "tmp", "managed", "project"].map((name) => [name, path.join(root, name)]))
await Promise.all(Object.values(locations).map((dir) => mkdir(dir, { recursive: true })))
await cp(input, locations.package, { recursive: true })
for (let dir = locations.package; ; dir = path.dirname(dir)) {
  assert(!(await readdir(dir)).includes("node_modules"), `Development dependencies could mask missing host dependencies: ${dir}`)
  if (dir === path.dirname(dir)) break
}
const configDir = path.join(locations.config, "opencode")
await mkdir(configDir, { recursive: true })
const tuiConfig = path.join(configDir, "tui.json")
const serverConfig = path.join(configDir, "opencode.json")
const evidencePath = path.join(root, "host-evidence.json")
const probePath = path.join(root, "observer.mjs")
const targetSpec = pathToFileURL(locations.package + path.sep).href
const npmUserConfig = path.join(root, "empty-user.npmrc")
const npmGlobalConfig = path.join(root, "empty-global.npmrc")
await Promise.all([writeFile(npmUserConfig, ""), writeFile(npmGlobalConfig, "")])
const inherited = new Set(["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TERM", "COLORTERM", "LANG", "LC_ALL", "LC_CTYPE"])
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => inherited.has(key.toUpperCase())))
Object.assign(env, {
  HOME: locations.home, USERPROFILE: locations.home,
  XDG_CONFIG_HOME: locations.config, XDG_DATA_HOME: locations.data,
  XDG_CACHE_HOME: locations.cache, XDG_STATE_HOME: locations.state,
  OPENCODE_TEST_HOME: locations.home, OPENCODE_TEST_MANAGED_CONFIG_DIR: locations.managed,
  OPENCODE_CONFIG: serverConfig, OPENCODE_TUI_CONFIG: tuiConfig,
  OPENCODE_DISABLE_PROJECT_CONFIG: "1", OPENCODE_DISABLE_AUTOUPDATE: "1", OPENCODE_DISABLE_MODELS_FETCH: "1",
  OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: "1", OPENCODE_DISABLE_TERMINAL_TITLE: "1",
  npm_config_userconfig: npmUserConfig, npm_config_globalconfig: npmGlobalConfig,
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
console.log(`Isolated V1 host smoke artifacts: ${root}`)
const hostVersion = (await execute(["--version"], "version")).trim().replace(/^opencode v/, "")
assert.match(hostVersion, /^1\.18\./, "This check requires OpenCode V1 1.18.x")
const timestamp = Date.now()
const tokens = { input: 1000, output: 200, reasoning: 100, cache: { read: 600, write: 100 } }
const model = { providerID: "host-smoke", modelID: "synthetic" }
await writeFile(serverConfig, JSON.stringify({
  autoupdate: false, enabled_providers: ["host-smoke"], permission: "deny", share: "disabled",
  provider: { "host-smoke": {
    name: "Host smoke", npm: "@ai-sdk/openai-compatible",
    options: { baseURL: "http://127.0.0.1:1/v1", apiKey: "synthetic-unused" },
    models: { synthetic: { name: "Synthetic", limit: { context: 10000, output: 1000 } } },
  } },
}))
let serial = 0
const user = (sessionID, id) => ({
  info: { id, sessionID, role: "user", agent: "build", model, time: { created: timestamp + serial++ } },
  parts: [{ id: `prt_${id}`, sessionID, messageID: id, type: "text", text: "Synthetic host acceptance fixture. No model was called." }],
})
const assistant = (sessionID, id, parentID, counts = tokens, extra = {}) => ({
  info: { id, sessionID, role: "assistant", parentID, agent: "build", mode: "build", ...model,
    path: { cwd: locations.project, root: locations.project }, tokens: counts, cost: 0, finish: "stop",
    time: { created: timestamp + serial++, completed: timestamp + serial }, ...extra },
  parts: [{ id: `prt_${id}`, sessionID, messageID: id, type: "text", text: "Synthetic assistant response." }],
})
const fixture = (name, makeMessages) => {
  const id = `ses_v1_smoke_${name}`
  return { info: { id, slug: `v1-smoke-${name}`, projectID: "global", directory: locations.project,
    title: `V1 host smoke: ${name}`, version: hostVersion, time: { created: timestamp, updated: timestamp } }, messages: makeMessages(id) }
}
const cases = [
  { name: "snapshot", value: fixture("snapshot", (id) => [user(id, "msg_snapshot_user"), assistant(id, "msg_snapshot_assistant", "msg_snapshot_user")]), expected: "20% used" },
  { name: "empty", value: fixture("empty", () => []), expected: "no usage snapshot yet" },
  { name: "revert", value: fixture("revert", (id) => [user(id, "msg_revert_user1"), assistant(id, "msg_revert_assistant1", "msg_revert_user1"), user(id, "msg_revert_user2"), assistant(id, "msg_revert_assistant2", "msg_revert_user2", { ...tokens, input: 9000 })]), expected: "20% used" },
  { name: "compacted", value: fixture("compacted", (id) => {
    const firstUser = user(id, "msg_compact_firstuser")
    const firstAssistant = assistant(id, "msg_compact_firstassistant", firstUser.info.id)
    const compact = user(id, "msg_compact_user")
    compact.parts = [{ id: "prt_compaction", sessionID: id, messageID: compact.info.id, type: "compaction", auto: false }]
    return [firstUser, firstAssistant, compact,
      assistant(id, "msg_compact_summary", compact.info.id, tokens, { summary: true, mode: "compaction", agent: "compaction" })]
  }), expected: "no usage snapshot yet" },
]
for (const item of cases) {
  const fixturePath = path.join(root, `fixture-${item.name}.json`)
  await writeFile(fixturePath, JSON.stringify(item.value))
  const stdout = await execute(["import", fixturePath], `import-${item.name}`)
  assert(stdout.includes(`Imported session: ${item.value.info.id}`), `Import did not confirm ${item.name}: ${stdout}`)
}
await writeFile(tuiConfig, JSON.stringify({ plugin: [targetSpec, pathToFileURL(probePath).href] }))
await writeFile(probePath, `import { writeFile } from "node:fs/promises"
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
export default {
  id: "opencode-tui-context-host-observer",
  async tui(api) {
    let cancelled = false
    api.lifecycle.onDispose(() => { cancelled = true })
    const evidence = { hostVersion: api.app.version, packageVersion: ${JSON.stringify(manifest.version)}, bundleHashes: ${JSON.stringify(bundleHashes)}, cases: [], scope: "Real V1 package loading, synthetic session rendering, actual revert and unrevert, compaction, resize and plugin deactivation/reactivation; no model request" }
    const run = async () => {
      await until(() => api.plugins.list().find((item) => item.id === "opencode-tui-context"), (item) => item?.active === true, "target plugin activated")
      await until(() => api.state.ready, (ready) => ready, "host state ready")
      api.renderer.resize(160, 48)
      for (const item of ${JSON.stringify(cases.map(({ name, value, expected }) => ({ name, sessionID: value.info.id, expected, messageIDs: value.messages.map((message) => message.info.id), partCounts: value.messages.map((message) => [message.info.id, message.parts.length]) })))}) {
        if (cancelled) return
        if (item.name === "revert") await api.client.session.revert({ sessionID: item.sessionID, messageID: "msg_revert_user2" }, { throwOnError: true })
        api.route.navigate("session", { sessionID: item.sessionID })
        // Empty output during hydration must not falsely pass the compaction case.
        await until(() => api.state.session.messages(item.sessionID).map((message) => message.id), (ids) => JSON.stringify(ids) === JSON.stringify(item.messageIDs), item.name + " messages hydrated")
        for (const [messageID, count] of item.partCounts) await until(() => api.state.part(messageID), (parts) => parts.length === count, item.name + " parts hydrated")
        if (item.name === "revert") await until(() => api.state.session.get(item.sessionID), (session) => session?.revert?.messageID === "msg_revert_user2", "revert synchronized")
        const panel = await until(() => snapshot(api.renderer), (value) => value?.width > 0 && value?.text.some((text) => text.includes(item.expected)), item.name)
        evidence.cases.push(JSON.parse(JSON.stringify({ name: item.name, panel, session: api.state.session.get(item.sessionID), messages: api.state.session.messages(item.sessionID) })))
        if (item.name === "revert") {
          await api.client.session.unrevert({ sessionID: item.sessionID }, { throwOnError: true })
          evidence.unreverted = await until(() => snapshot(api.renderer), (value) => value?.text.includes("100% used"), "unrevert refreshes panel")
        }
      }
      api.route.navigate("session", { sessionID: ${JSON.stringify(cases[0].value.info.id)} })
      await until(() => snapshot(api.renderer), (value) => value?.text.includes("20% used"), "return to snapshot")
      api.renderer.resize(120, 40)
      await until(() => snapshot(api.renderer), (value) => value === undefined, "host hides sidebar in narrow terminal")
      evidence.sidebarHiddenAt120 = true
      api.renderer.resize(160, 48)
      evidence.restoredAt160 = await until(() => snapshot(api.renderer), (value) => value?.text.includes("20% used"), "wide terminal restores sidebar")
      if (!await api.plugins.deactivate("opencode-tui-context")) throw new Error("Host could not deactivate target")
      await until(() => snapshot(api.renderer), (value) => value === undefined, "deactivation removes panel")
      evidence.disabled = true
      evidence.disabledStatus = api.plugins.list().find((item) => item.id === "opencode-tui-context")
      if (evidence.disabledStatus.active) throw new Error("Target remains active after deactivation")
      if (!await api.plugins.activate("opencode-tui-context")) throw new Error("Host could not reactivate target")
      evidence.reenabled = await until(() => snapshot(api.renderer), (value) => value?.text.includes("20% used"), "reactivation restores panel")
      const panels = descendants(api.renderer.root).filter((node) => node.id === "opencode-tui-context-panel")
      if (panels.length !== 1) throw new Error("Expected one panel after reactivation, found " + panels.length)
      evidence.frameId = api.renderer.frameId
      evidence.target = api.plugins.list().find((item) => item.id === "opencode-tui-context")
      evidence.verifiedAt = new Date().toISOString()
      evidence.passed = true
    }
    run().catch((error) => { evidence.error = String(error?.stack ?? error) }).finally(async () => {
      await writeFile(${JSON.stringify(evidencePath)}, JSON.stringify(evidence, null, 2))
      api.keymap.dispatchCommand("app.exit")
    })
  },
}
`)
await execute([locations.project, "--log-level", "DEBUG"], "tui", true)
const evidence = JSON.parse(await readFile(evidencePath, "utf8"))
assert.equal(evidence.passed, true, evidence.error ?? `Host acceptance failed; inspect ${evidencePath}`)
assert(evidence.frameId > 0, "Real host must render a frame")
assert.equal(evidence.target?.id, manifest.name)
assert.equal(evidence.target?.spec, targetSpec)
assert.equal(evidence.target?.enabled, true)
assert.equal(evidence.target?.active, true)
assert.equal(evidence.disabled, true)
assert.equal(evidence.sidebarHiddenAt120, true)
assert(evidence.restoredAt160)
assert(evidence.reenabled)
console.log(`PASS: OpenCode ${hostVersion} rendered ${manifest.name}@${manifest.version}, reverted/unreverted, resized, deactivated and reactivated the plugin.`)
console.log(`Evidence: ${evidencePath}`)
console.log("Scope: isolated terminal host with synthetic token data. This does not call or certify any external model provider.")
