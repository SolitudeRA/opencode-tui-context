import { build } from "esbuild";
import { mkdirSync } from "node:fs";
mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["src/tui.tsx"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  jsx: "automatic",
  jsxImportSource: "@opentui/solid",
  external: ["@opencode-ai/plugin", "@opentui/core", "@opentui/solid", "solid-js"],
  outfile: "dist/tui.js",
  logLevel: "info",
});
