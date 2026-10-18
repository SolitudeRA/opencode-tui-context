import { build } from "esbuild";
import { transformAsync } from "@babel/core";
import presetSolid from "babel-preset-solid";
import presetTypeScript from "@babel/preset-typescript";
import { mkdirSync, readFileSync } from "node:fs";
mkdirSync("dist", { recursive: true });
await build({
  entryPoints: ["src/tui.tsx"],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "es2022",
  // Compile reactive JSX before bundling. Automatic JSX evaluates props once and
  // would leave token counts, theme changes and measured widths stale in V2.
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
  external: ["@opencode/plugin", "@opentui/core", "@opentui/solid", "solid-js"],
  outfile: "dist/tui.js",
  logLevel: "info",
});
