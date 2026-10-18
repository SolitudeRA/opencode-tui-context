// Check the shipped entry in fresh processes without development dependencies.
// Only module linkage and registration are mocked; rendering is checked separately.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repository = fileURLToPath(new URL("../", import.meta.url));
const temporaryRoot = path.resolve(os.tmpdir());
const root = mkdtempSync(path.join(temporaryRoot, "opencode-tui-context-entrypoints-"));
const mockModules = {
  "@opentui/core": "export const RGBA = { fromHex: (value) => value };",
  "@opentui/solid": `
    export const createComponent = (component, props) => ({ component, props });
    export const createElement = () => { throw new Error("This check must not render components."); };
    export const createTextNode = createElement;
    export const memo = (fn) => fn;
    export const use = () => {};
    export const effect = () => {};
    export const insertNode = () => {};
    export const insert = () => {};
    export const setProp = () => {};
  `,
  "solid-js": `
    export const createMemo = (fn) => fn;
    export function createSignal(initial) {
      let value = initial;
      return [() => value, (next) => value = typeof next === "function" ? next(value) : next];
    }
    export const onMount = () => {};
    export const Show = () => {};
  `,
  "@opencode/plugin/tui": `
    export const Plugin = { define(definition) {
      globalThis.definitions.push(definition);
      return definition;
    } };
  `,
};
const runner = `
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
const mode = process.argv[2];
const resolved = [];
globalThis.fetch = () => { throw new Error("Entrypoint checks must not access the network."); };
globalThis.definitions = [];
const modules = ${JSON.stringify(mockModules)};
registerHooks({
  resolve(specifier, context, next) {
    resolved.push(specifier);
    if (/tui-v[12]\\.js$/.test(specifier)) {
      assert.notEqual(mode, "bare", "Importing the public entry must not load any adapter.");
      assert(specifier.endsWith("tui-" + mode + ".js"), "The other host adapter must remain unloaded.");
    }
    if (/^(?:@opencode(?:-ai)?\\/|@opentui\\/|solid-js(?:\\/|$))/.test(specifier)) {
      assert.notEqual(mode, "bare", "The public entry must import without host dependencies.");
      if (specifier.startsWith("@opencode")) {
        assert.equal(mode, "v2", "V1 must not need a runtime SDK import.");
        assert.equal(specifier, "@opencode/plugin/tui", "Only the selected host SDK is available.");
      }
      assert(Object.hasOwn(modules, specifier), "Unexpected runtime dependency: " + specifier);
      return { url: "data:text/javascript," + encodeURIComponent(modules[specifier]), shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const { default: definition } = await import("./tui.js");
assert.equal(definition.id, "opencode-tui-context");
assert.equal(typeof definition.tui, "function");
assert.equal(typeof definition.setup, "function");
assert.equal(globalThis.definitions.length, 0, "V2 SDK initialization must be deferred until setup.");
if (mode === "v1") {
  const listeners = new Map();
  const disposers = [];
  let registrations = 0, removed = 0, rendered = 0, claim;
  const api = {
    lifecycle: { signal: new AbortController().signal, onDispose(fn) { disposers.push(fn); } },
    event: { on(name, fn) {
      assert(!listeners.has(name));
      listeners.set(name, fn);
      return () => { listeners.delete(name); removed++; };
    } },
    renderer: { requestRender() { rendered++; } },
    slots: { register(value) { registrations++; claim = value; return "fixture-slot"; } },
  };
  assert.equal(await definition.tui(api, { barWidth: 31, showLegend: false }), undefined);
  assert.equal(registrations, 1);
  assert.equal(typeof claim.slots.sidebar_content, "function");
  const panel = claim.slots.sidebar_content({}, { session_id: "fixture" });
  assert.equal(panel.props.config.barWidth, 31, "The public V1 entry must forward options.");
  assert.equal(panel.props.config.showLegend, false);
  assert(listeners.size > 0);
  const subscriptions = listeners.size;
  const callback = listeners.values().next().value;
  callback();
  assert.equal(rendered, 1);
  for (const dispose of disposers) dispose();
  assert.equal(removed, subscriptions, "V1 lifecycle cleanup must release subscriptions.");
  callback();
  assert.equal(rendered, 1, "Disposed V1 callbacks must not repaint.");
  assert.equal(globalThis.definitions.length, 0);
} else if (mode === "v2") {
  let registrations = 0, removed = 0, claim;
  const context = {
    options: { barWidth: 37, showLegend: false },
    ui: { slot(value) { registrations++; claim = value; return () => { removed++; }; } },
  };
  const cleanup = await definition.setup(context);
  assert.equal(globalThis.definitions.length, 1, "The V2 adapter must use Plugin.define.");
  assert.equal(globalThis.definitions[0].id, definition.id);
  assert.equal(registrations, 1);
  assert.equal(claim.append, "sidebar.content");
  const panel = claim.render({ sessionID: "fixture" });
  assert.equal(panel.props.config.barWidth, 37, "The public V2 entry must forward context options.");
  assert.equal(panel.props.config.showLegend, false);
  assert.equal(typeof cleanup, "function");
  cleanup();
  assert.equal(removed, 1, "The public V2 entry must return the adapter cleanup.");
} else {
  assert.equal(mode, "bare");
}
if (mode !== "bare") assert(resolved.some((value) => value.endsWith("tui-" + mode + ".js")));
console.log("PASS: " + mode + " entrypoint isolation");
`;

try {
  for (let directory = root; ; directory = path.dirname(directory)) {
    assert(!existsSync(path.join(directory, "node_modules")),
      `Development dependencies could mask missing runtime isolation: ${directory}`);
    if (directory === path.dirname(directory)) break;
  }
  for (const mode of ["bare", "v1", "v2"]) {
    const directory = path.join(root, mode);
    mkdirSync(path.join(directory, "dist"), { recursive: true });
    writeFileSync(path.join(directory, "package.json"), JSON.stringify({ type: "module" }));
    copyFileSync(path.join(repository, "tui.js"), path.join(directory, "tui.js"));
    copyFileSync(path.join(repository, "dist", "tui.js"), path.join(directory, "dist", "tui.js"));
    // The other adapter is physically absent, not only hidden by the mock loader.
    if (mode !== "bare") copyFileSync(path.join(repository, "dist", `tui-${mode}.js`), path.join(directory, "dist", `tui-${mode}.js`));
    writeFileSync(path.join(directory, "run.mjs"), runner);
    const inherited = new Set(["PATH", "PATHEXT", "SYSTEMROOT", "WINDIR", "COMSPEC", "TMP", "TEMP", "TMPDIR"]);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => inherited.has(key.toUpperCase())));
    const result = spawnSync(process.execPath, ["run.mjs", mode], {
      cwd: directory, env, encoding: "utf8", timeout: 20000, windowsHide: true,
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${mode} entrypoint failed:\n${result.stdout}\n${result.stderr}`);
    process.stdout.write(result.stdout);
  }
} finally {
  assert.equal(path.dirname(path.resolve(root)), temporaryRoot);
  assert(path.basename(root).startsWith("opencode-tui-context-entrypoints-"));
  rmSync(root, { recursive: true, force: true });
}
