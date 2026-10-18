import { build } from "esbuild";
import { transformAsync } from "@babel/core";
import presetSolid from "babel-preset-solid";
import presetTypeScript from "@babel/preset-typescript";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
mkdirSync("dist", { recursive: true });
const runtimeModules = ["@opencode-ai/plugin", "@opencode/plugin", "@opentui/core", "@opentui/solid", "solid-js"];
const options = {
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  // Both adapters share the reactive panel. Compile JSX before bundling so the
  // host's Solid runtime observes token counts, themes and measured widths.
  plugins: [{
    name: "opentui-solid",
    setup(build) {
      build.onLoad({ filter: /\.tsx$/ }, async ({ path }) => {
        const result = await transformAsync(readFileSync(path, "utf8"), {
          filename: path,
          babelrc: false,
          configFile: false,
          presets: [
            [presetSolid, { generate: "universal", moduleName: "@opentui/solid" }],
            [presetTypeScript, { allExtensions: true, isTSX: true }],
          ],
        });
        if (!result?.code) throw new Error(`JSX compilation failed: ${path}`);
        return { contents: result.code, loader: "js" };
      });
    },
  }],
  logLevel: "info",
};
const [entry] = await Promise.all([
  build({
    ...options,
    entryPoints: ["src/tui.tsx"],
    external: ["./tui-v1.js", "./tui-v2.js"],
    outfile: "dist/tui.js",
    metafile: true,
  }),
  ...["v1", "v2"].map((version) => build({
    ...options,
    entryPoints: [`src/tui-${version}.tsx`],
    external: runtimeModules,
    outfile: `dist/tui-${version}.js`,
  })),
]);
assert.deepEqual(Object.keys(entry.metafile.inputs), ["src/tui.tsx"],
  "The universal entry must not bundle an adapter or host runtime.");
