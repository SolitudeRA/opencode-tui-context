// Run with test-v1-runtime.mjs preloaded so the built adapter uses OpenTUI 0.4.5
// and Solid 1.9.12 throughout. The host cache/events are simulated; rendering is real.
import assert from "node:assert/strict";
import { RGBA, rgbToHex } from "@opentui/core";
import { testRender, createComponent } from "@opentui/solid";
import { createSignal, Show } from "solid-js";
import { createStore } from "solid-js/store";

const originalFetch = globalThis.fetch;
let networkRequests = 0;
globalThis.fetch = () => { networkRequests++; throw new Error("V1 renderer checks must not make network requests"); };
const { default: definition } = await import("../dist/tui.js");
const color = (value) => RGBA.fromHex(value);
const [theme, setTheme] = createStore({
  primary: color("#ff8000"), secondary: color("#0088ff"), accent: color("#ff00ff"),
  success: color("#00ff88"), warning: color("#ffaa00"), text: color("#eeeeee"),
  textMuted: color("#777777"), borderSubtle: color("#333333"),
});
// Intentionally plain cache data: V1 events must invalidate the rendered snapshot.
const data = {
  sessions: { a: { id: "a" }, b: { id: "b" } }, messages: { a: [], b: [] }, parts: {},
  provider: [{ id: "fixture", models: {
    alpha: { limit: { context: 10000, output: 1000 } },
    beta: { limit: { context: 20000, output: 1000 } },
  } }],
};
const assistant = (id, input, output, modelID = "alpha", extras = {}) => ({
  id, role: "assistant", providerID: "fixture", modelID,
  tokens: { input, output, reasoning: 0, cache: { read: 0, write: 0 }, ...extras },
});
const listeners = new Map();
const disposal = [];
const controller = new AbortController();
const [sessionID, setSessionID] = createSignal("a");
const [claim, setClaim] = createSignal();
let registrations = 0, requests = 0;
const api = {
  theme: { current: theme },
  state: {
    provider: data.provider,
    session: { get: (id) => data.sessions[id], messages: (id) => data.messages[id] ?? [] },
    part: (id) => data.parts[id] ?? [],
  },
  renderer: { requestRender() { requests++; } },
  lifecycle: { signal: controller.signal, onDispose(fn) { disposal.push(fn); return () => {}; } },
  event: { on(name, fn) {
    const subscribers = listeners.get(name) ?? new Set();
    listeners.set(name, subscribers); subscribers.add(fn);
    return () => subscribers.delete(fn);
  } },
  slots: { register(value) {
    assert.equal(value.order, 60); registrations++;
    assert.equal(claim(), undefined); setClaim(value);
    // V1's scoped slot API removes a contribution when its plugin is disposed.
    disposal.push(() => setClaim(undefined));
  } },
};
const emit = (name = "message.updated") => { for (const fn of listeners.get(name) ?? []) fn({ type: name }); };
await definition.tui(api, {}, { id: definition.id });
const setup = await testRender(() => createComponent(Show, {
  get when() { return claim(); },
  children: (current) => current().slots.sidebar_content({}, { get session_id() { return sessionID(); } }),
}), { width: 70, height: 24, useThread: false });
async function frame() {
  for (let pass = 0; pass < 3; pass++) { await Promise.resolve(); await setup.renderOnce(); }
  return setup.captureCharFrame();
}
function includes(actual, expected, label) { assert(actual.includes(expected), `${label}: missing ${expected}\n${actual}`); }
function bars(actual) {
  return actual.split("\n").flatMap((line) => {
    const match = line.match(/^\s*([▓░]+)\s*$/u); return match ? [match[1]] : [];
  });
}
function fgFor(text) {
  const span = setup.captureSpans().lines.flatMap((line) => line.spans).find((item) => item.text.includes(text));
  assert(span); return rgbToHex(span.fg).toLowerCase();
}
let disposed = false;
function dispose() {
  if (disposed) return;
  disposed = true; controller.abort();
  for (const fn of disposal) fn();
}
const passed = [];
try {
  includes(await frame(), "no usage snapshot yet", "empty"); passed.push("empty session");
  data.messages.a = [assistant("a1", 1000, 100, "alpha", { reasoning: 100, cache: { read: 800, write: 0 } })];
  emit(); let current = await frame();
  includes(current, "20% used", "first snapshot"); includes(current, "c 800", "cache legend");
  data.messages.a[0].tokens.output = 200; emit();
  data.messages.a[0].tokens.output = 300; emit();
  current = await frame(); includes(current, "22% used", "last rapid update"); includes(current, "o 300", "legend update");
  passed.push("plain-cache events preserve the final rapid update");

  data.sessions.a.modelID = "beta"; emit("session.updated");
  includes(await frame(), "22% used", "selected model does not change snapshot limits");
  data.messages.a[0].modelID = "beta"; emit();
  includes(await frame(), "11% used", "message model limits");
  data.messages.b = [assistant("b1", 500, 100)]; setSessionID("b");
  includes(await frame(), "6% used", "session switch"); passed.push("session and message-model selection");

  data.messages.b.push(assistant("b2", 1000, 200)); emit();
  includes(await frame(), "12% used", "latest");
  data.sessions.b.revert = { messageID: "b2" }; emit("session.updated");
  includes(await frame(), "6% used", "revert");
  data.sessions.b.revert.messageID = "missing"; emit("session.updated");
  includes(await frame(), "no usage snapshot yet", "missing boundary");
  delete data.sessions.b.revert; emit("session.updated");
  includes(await frame(), "12% used", "unrevert"); passed.push("revert and unknown history");

  data.messages.b.push({ id: "request", role: "user" }, { ...assistant("summary", 9000, 999), parentID: "request", summary: true });
  data.parts.request = [{ type: "compaction" }]; emit();
  includes(await frame(), "12% used", "running summary does not replace snapshot");
  data.messages.b.at(-1).finish = "stop"; emit("session.compacted");
  includes(await frame(), "no usage snapshot yet", "completed compaction");
  data.messages.b.push(assistant("next", 200, 0)); emit();
  includes(await frame(), "no usage snapshot yet", "zero output after compaction");
  data.messages.b.at(-1).tokens.output = 200; emit("message.part.updated");
  includes(await frame(), "4% used", "post-compaction usage"); passed.push("V1 summary compaction and streaming usage");

  for (const width of [30, 12, 8, 70]) {
    setup.resize(width, 24); current = await frame();
    assert.deepEqual(bars(current).map((bar) => bar.length), [width - 2, width - 2]);
    if (width === 12) { includes(current, "Context", "narrow title"); assert(!current.includes("% used")); }
    if (width === 8) assert(!current.includes("Context"));
  }
  includes(current, "4% used", "wide restoration"); passed.push("resize and narrow layout restoration");
  assert.equal(fgFor("Context"), "#eeeeee");
  setTheme("text", color("#112233")); setTheme("primary", color("#44bbcc")); await frame();
  assert.equal(fgFor("Context"), "#112233"); assert.equal(fgFor("4% used"), "#44bbcc");
  passed.push("V1 theme colors update in actual frame spans");

  assert.equal(registrations, 1); assert(requests > 0); dispose();
  assert.equal([...listeners.values()].reduce((sum, set) => sum + set.size, 0), 0);
  assert.equal((await frame()).trim(), "");
  const stopped = requests; data.messages.b.at(-1).tokens.output = 300; emit();
  assert.equal(requests, stopped); assert.equal((await frame()).trim(), "");
  passed.push("host disposal removes the slot and event subscriptions");
  assert.equal(networkRequests, 0);
  console.log(JSON.stringify({ test: "built-plugin V1 OpenTUI 0.4.5 contract", passed, networkRequests }, null, 2));
} finally { dispose(); setup.renderer.destroy(); globalThis.fetch = originalFetch; }
