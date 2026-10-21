// Run after `npm run build`: bun --conditions=browser scripts/test-render.mjs
// This is a host-contract test: the real prebuilt plugin runs in OpenTUI's native
// test renderer against reactive mock V2 data. It does not launch OpenCode.
import assert from "node:assert/strict";
import { plugin as registerBunPlugin } from "bun";
import { RGBA, rgbToHex } from "@opentui/core";
import { testRender, createComponent } from "@opentui/solid";
import { createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";

const originalFetch = globalThis.fetch;
let networkRequests = 0;
globalThis.fetch = () => {
  networkRequests++;
  throw new Error("The renderer contract test must not make network requests.");
};

// OpenCode supplies this module to plugins. Mock only its identity-definition
// boundary; Solid, the compiled JSX, OpenTUI, layout, and frame buffers are real.
registerBunPlugin({
  name: "test-v2-plugin-definition",
  setup(builder) {
    builder.onResolve({ filter: /^@opencode\/plugin\/tui$/ }, () => ({
      path: "definition", namespace: "test-v2-plugin",
    }));
    builder.onLoad({ filter: /.*/, namespace: "test-v2-plugin" }, () => ({
      contents: "export const Plugin = { define: (definition) => definition };", loader: "js",
    }));
  },
});
const { default: definition } = await import("../dist/tui.js");
assert.equal(definition.id, "opencode-tui-context");

const color = (value) => RGBA.fromHex(value);
const [theme, setTheme] = createStore({
  hue: { interactive: { 500: color("#ff8000") }, accent: { 500: color("#ff00ff") } },
  text: {
    base: color("#eeeeee"), muted: color("#777777"),
    feedback: {
      info: { base: color("#0088ff") },
      success: { base: color("#00ff88") },
      warning: { base: color("#ffaa00") },
    },
  },
  border: { base: color("#333333") },
});
const locationA = { directory: "/fixture/a" };
const locationB = { directory: "/fixture/b" };
const [data, setData] = createStore({
  sessions: {
    a: { id: "a", location: locationA },
    b: { id: "b", location: locationB },
  },
  messages: { a: [], b: [] },
  models: {
    [locationA.directory]: [
      { id: "alpha", providerID: "fixture", limit: { context: 10000, output: 1000 } },
      { id: "beta", providerID: "fixture", limit: { context: 20000, output: 1000 } },
    ],
    [locationB.directory]: [
      { id: "alpha", providerID: "fixture", limit: { context: 2000, output: 500 } },
    ],
  },
});
const assistant = (id, input, output, model = "alpha", extras = {}) => ({
  id, type: "assistant", model: { providerID: "fixture", id: model },
  tokens: { input, output, reasoning: 0, cache: { read: 0, write: 0 }, ...extras },
});
const [sessionID, setSessionID] = createSignal("a");
const [claim, setClaim] = createSignal();
let setupCalls = 0;
let unregisterCalls = 0;
const context = {
  options: {}, theme,
  data: {
    session: {
      get: (id) => data.sessions[id],
      message: { list: (id) => data.messages[id] ?? [] },
    },
    location: { model: { list: (location) => data.models[location.directory] } },
  },
  ui: {
    slot(value) {
      setupCalls++;
      assert.equal(value.append, "sidebar.content");
      assert.equal(claim(), undefined, "Only one sidebar contribution should be registered.");
      setClaim(value);
      return () => {
        unregisterCalls++;
        setClaim(undefined);
      };
    },
  },
};
const cleanup = await definition.setup(context);
assert.equal(typeof cleanup, "function", "setup must return its slot cleanup.");
const setup = await testRender(() => createComponent(Show, {
  get when() { return claim(); },
  children: (currentClaim) => currentClaim().render({ get sessionID() { return sessionID(); } }),
}), { width: 70, height: 24, useThread: false });
const passed = [];
let cleaned = false;

async function frame() {
  // A size-change callback may update Solid after the first native layout pass.
  // Three deterministic passes also exercise the layout-to-state feedback path.
  for (let pass = 0; pass < 3; pass++) {
    await Promise.resolve();
    await setup.renderOnce();
  }
  return setup.captureCharFrame();
}
function includes(actual, expected, label) {
  assert.ok(actual.includes(expected), `${label}: missing ${JSON.stringify(expected)}\n${actual}`);
}
function bars(actual) {
  return actual.split("\n").flatMap((line) => {
    const match = line.match(/^\s*([▓░]+)\s*$/u);
    return match ? [match[1]] : [];
  });
}
function fgFor(text) {
  const span = setup.captureSpans().lines.flatMap((line) => line.spans).find((span) => span.text.includes(text));
  assert.ok(span, `No rendered color span contains ${JSON.stringify(text)}.`);
  return rgbToHex(span.fg).toLowerCase();
}

try {
  includes(await frame(), "no usage snapshot yet", "empty session");
  passed.push("empty session");

  const first = assistant("a1", 1000, 100, "alpha", { reasoning: 100, cache: { read: 800, write: 0 } });
  setData("messages", "a", [first]);
  let current = await frame();
  includes(current, "20% used", "first usage update");
  includes(current, "u 2K", "total legend");
  includes(current, "c 800", "cache legend");
  // The composition allocator intentionally permits rounding slack (one cell here).
  assert.deepEqual(bars(current).map((bar) => bar.length), [68, 67]);
  setData("messages", "a", 0, "tokens", "output", 300);
  current = await frame();
  includes(current, "22% used", "in-place token update");
  includes(current, "o 300", "output legend update");
  passed.push("reactive token and legend updates");

  setData("sessions", "a", "model", { providerID: "fixture", id: "beta" });
  includes(await frame(), "22% used", "changing selected model preserves the measured message model");
  setData("messages", "a", 0, "model", "id", "beta");
  includes(await frame(), "11% used", "message model change updates capacity");
  passed.push("message model lookup");

  setData("messages", "b", [assistant("b1", 500, 100)]);
  setSessionID("b");
  includes(await frame(), "30% used", "sidebar session and location change");
  setData("models", locationB.directory, 0, "limit", "context", 4000);
  includes(await frame(), "15% used", "reactive location model metadata");
  passed.push("session switching and location-specific limits");

  setData("messages", "b", [assistant("b1", 500, 100), assistant("b2", 1000, 200)]);
  includes(await frame(), "30% used", "latest assistant");
  setData("sessions", "b", "revert", { messageID: "b2" });
  includes(await frame(), "15% used", "revert boundary");
  setData("sessions", "b", "revert", "messageID", "not-loaded");
  includes(await frame(), "no usage snapshot yet", "missing revert boundary");
  setData("sessions", "b", "revert", undefined);
  includes(await frame(), "30% used", "clear revert");
  passed.push("revert and incomplete-history boundaries");

  setData("messages", "b", (messages) => [...messages,
    { id: "b3", type: "compaction", status: "completed", tokens: { output: 999 } },
  ]);
  includes(await frame(), "no usage snapshot yet", "completed compaction clears old usage");
  setData("messages", "b", (messages) => [...messages, assistant("b4", 200, 0)]);
  includes(await frame(), "no usage snapshot yet", "zero-output post-compaction step");
  setData("messages", "b", 3, "tokens", "output", 200);
  includes(await frame(), "10% used", "post-compaction usage");
  passed.push("compaction and subsequent streaming usage");

  for (const width of [30, 12, 8, 70]) {
    setup.resize(width, 24);
    current = await frame();
    assert.deepEqual(bars(current).map((bar) => bar.length), [width - 2, width - 2], `bar width at ${width}\n${current}`);
    if (width === 12) {
      includes(current, "Context", "narrow title");
      assert.ok(!current.includes("% used"), `Percentage must hide when it cannot fit.\n${current}`);
    }
    if (width === 8) assert.ok(!current.includes("Context"), `Title must hide in an eight-column panel.\n${current}`);
  }
  includes(current, "10% used", "restored wide title");
  includes(current, "o 200", "restored wide legends");
  passed.push("terminal resize and responsive restoration");

  assert.equal(fgFor("Context"), "#eeeeee");
  assert.equal(fgFor("10% used"), "#ff8000");
  setTheme("text", "base", color("#112233"));
  setTheme("hue", "interactive", 500, color("#44bbcc"));
  await frame();
  assert.equal(fgFor("Context"), "#112233");
  assert.equal(fgFor("10% used"), "#44bbcc");
  passed.push("live theme colors in native frame spans");

  assert.equal(setupCalls, 1, "Updates must work without re-registering the plugin.");
  await cleanup();
  cleaned = true;
  assert.equal(unregisterCalls, 1);
  assert.equal((await frame()).trim(), "", "Cleanup must remove the rendered slot.");
  setData("messages", "b", 3, "tokens", "output", 300);
  assert.equal((await frame()).trim(), "", "Disposed contributions must stay removed after data changes.");
  passed.push("setup cleanup removes and disposes the slot");
  assert.equal(networkRequests, 0, "The plugin must use only the supplied usage cache.");
  console.log(JSON.stringify({ test: "built-plugin OpenTUI host contract", passed, networkRequests }, null, 2));
} finally {
  if (!cleaned) await cleanup();
  setup.renderer.destroy();
  globalThis.fetch = originalFetch;
}
