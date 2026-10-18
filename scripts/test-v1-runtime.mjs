// Preload before the contract test links its modules: every import, including
// the compiled adapter, must share the V1 host's Solid and OpenTUI instances.
import { plugin } from "bun";
import { fileURLToPath } from "node:url";

plugin({
  name: "v1-host-runtime",
  setup(builder) {
    for (const [name, alias] of [
      ["@opentui/core", "@opentui/core-v1"],
      ["@opentui/solid", "@opentui/solid-v1"],
      ["solid-js", "solid-js-v1"],
    ]) {
      builder.onResolve({ filter: new RegExp(`^${name}(?:/.*)?$`) }, (args) => ({
        path: fileURLToPath(import.meta.resolve(alias + args.path.slice(name.length))),
      }));
    }
    builder.onResolve({ filter: /^@opencode(?:-ai)?\/plugin(?:\/|$)/ }, (args) => {
      throw new Error(`The V1 adapter must not import a plugin SDK at runtime: ${args.path}`);
    });
  },
});
