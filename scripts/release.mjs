import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, zipSync } from "fflate";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const npmCli = process.env.npm_execpath;
assert(npmCli && /npm-cli\.js$/.test(npmCli), "Run this script with npm run release:pack.");
assert.equal(manifest.name, "opencode-tui-context");
assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);

const required = [
  "LICENSE",
  "README.ja.md",
  "README.md",
  "README.zh-CN.md",
  "dist/tui.js",
  "dist/tui-v1.js",
  "dist/tui-v2.js",
  "docs/assets/context-preview.svg",
  "package.json",
  "tui.js",
].sort();
const outDir = path.join(root, "release");
mkdirSync(outDir, { recursive: true });
const staging = mkdtempSync(path.join(outDir, ".pack-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true, ...options });
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${path.basename(command)} failed:\n${result.stdout}`);
  return result.stdout;
}

function verifyIsolatedInstall(tarball, files) {
  const temporaryRoot = path.resolve(os.tmpdir());
  const project = mkdtempSync(path.join(temporaryRoot, "opencode-tui-context-install-"));
  try {
    writeFileSync(path.join(project, "package.json"), JSON.stringify({
      name: "isolated-plugin-install", version: "0.0.0", private: true,
    }));
    const userConfig = path.join(project, "user.npmrc");
    const globalConfig = path.join(project, "global.npmrc");
    writeFileSync(userConfig, "");
    writeFileSync(globalConfig, "");
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
      if (/^(?:npm_config_|npm_token$|node_auth_token$|node_path$)/i.test(key)) delete env[key];
    }
    Object.assign(env, {
      HOME: project,
      USERPROFILE: project,
      NPM_CONFIG_USERCONFIG: userConfig,
      NPM_CONFIG_GLOBALCONFIG: globalConfig,
      NPM_CONFIG_CACHE: path.join(project, "cache"),
    });
    // Exercise npm's normal peer resolver with a clean cache. Offline mode can
    // silently skip optional peers and conceal an installation conflict.
    run(process.execPath, [
      npmCli, "install", tarball, "--ignore-scripts", "--no-audit", "--no-fund",
      "--no-update-notifier", "--package-lock=true", "--registry=https://registry.npmjs.org/",
    ], { cwd: project, env, timeout: 60_000 });
    const lock = JSON.parse(readFileSync(path.join(project, "package-lock.json"), "utf8"));
    assert.deepEqual(Object.keys(lock.packages).sort(), ["", `node_modules/${manifest.name}`],
      "Installing the plugin must not install host SDKs or renderer dependencies.");
    for (const [file, bytes] of Object.entries(files)) {
      assert.deepEqual(readFileSync(path.join(project, "node_modules", manifest.name, file)), bytes,
        `The installed package differs from the release archive: ${file}`);
    }
    console.log("Verified a clean npm install with normal dependency resolution and no host runtime dependencies.");
  } finally {
    assert.equal(path.dirname(path.resolve(project)), temporaryRoot);
    assert(path.basename(project).startsWith("opencode-tui-context-install-"));
    rmSync(project, { recursive: true, force: true });
  }
}

try {
  // npm's prepack hook builds first, including from a clean checkout with no dist/.
  const [packed] = JSON.parse(run(process.execPath, [
    npmCli, "pack", "--json", "--ignore-scripts=false", "--pack-destination", staging,
  ]));
  assert(packed, "npm pack did not report a package.");
  const basename = `${manifest.name}-${manifest.version}`;
  assert.equal(packed.filename, `${basename}.tgz`);
  assert.deepEqual(packed.files.map((file) => file.path).sort(), required,
    "Unexpected package contents. Review the publication allowlist before releasing.");
  const tarball = path.join(staging, packed.filename);
  const tarBytes = readFileSync(tarball);
  assert.equal(`sha512-${createHash("sha512").update(tarBytes).digest("base64")}`, packed.integrity,
    "Packed tarball integrity does not match npm's report.");

  // Inspect the actual archive before extraction, then create the ZIP from those bytes,
  // so npm and manual-install users receive exactly the same plugin and manifest.
  const entries = run("tar", ["-tzf", tarball]).trim().split(/\r?\n/).filter((entry) => !entry.endsWith("/"));
  assert.deepEqual(entries.sort(), required.map((file) => `package/${file}`).sort());
  run("tar", ["-xzf", tarball, "-C", staging]);
  const files = Object.fromEntries(required.map((file) => {
    const absolute = path.join(staging, "package", file);
    assert(lstatSync(absolute).isFile(), `Not a regular file: ${file}`);
    return [file, readFileSync(absolute)];
  }));
  const shipped = JSON.parse(files["package.json"].toString("utf8"));
  assert.equal(shipped.name, manifest.name);
  assert.equal(shipped.version, manifest.version);
  assert.equal(shipped.exports?.["./tui"]?.import, "./dist/tui.js");
  assert(files["tui.js"].toString("utf8").includes('export { default } from "./dist/tui.js"'),
    "Local directory installs require the root TUI entry.");
  assert.equal(Object.keys(shipped.dependencies ?? {}).length, 0, "Unexpected runtime dependencies.");
  assert.equal(Object.keys(shipped.optionalDependencies ?? {}).length, 0, "Unexpected optional runtime dependencies.");
  assert.equal(Object.keys(shipped.peerDependencies ?? {}).length, 0,
    "Host runtimes must not become part of npm's peer dependency resolution.");
  assert.equal(Object.keys(shipped.peerDependenciesMeta ?? {}).length, 0,
    "Host runtimes must not declare optional peers.");
  assert.equal(shipped.engines?.opencode, ">=1.18.31 <2 || >=2.0.32 <3");
  for (const file of ["dist/tui.js", "dist/tui-v1.js", "dist/tui-v2.js"]) {
    assert(files[file].length > 0, `The bundle is empty: ${file}`);
  }
  const entry = files["dist/tui.js"].toString("utf8");
  assert.match(entry, /\bimport\(["']\.\/tui-v1\.js["']\)/,
    "The universal entry must load the V1 adapter lazily.");
  assert.match(entry, /\bimport\(["']\.\/tui-v2\.js["']\)/,
    "The universal entry must load the V2 adapter lazily.");
  assert(!/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](?:@opencode(?:-ai)?\/|@opentui\/|solid-js)/.test(entry),
    "The universal entry must not import a host runtime.");
  const v1 = files["dist/tui-v1.js"].toString("utf8");
  const v2 = files["dist/tui-v2.js"].toString("utf8");
  assert(v2.includes('from "@opencode/plugin/tui"'), "The V2 adapter must use the V2 TUI runtime.");
  assert(!v2.includes("@opencode-ai/plugin"), "The V2 adapter must not import the V1 SDK.");
  assert(!v1.includes("@opencode/plugin"), "The V1 adapter must not import the V2 SDK.");
  verifyIsolatedInstall(tarball, files);

  const zipFiles = Object.fromEntries(required.map((file) => [`${manifest.name}/${file}`, files[file]]));
  // ZIP stores local calendar fields, so use a fixed local date on every platform.
  const zipBytes = zipSync(zipFiles, { level: 9, mtime: new Date(2000, 0, 1) });
  const unzipped = unzipSync(zipBytes);
  assert.deepEqual(Object.keys(unzipped).sort(), Object.keys(zipFiles).sort());
  for (const [file, bytes] of Object.entries(zipFiles)) {
    assert.deepEqual(Buffer.from(unzipped[file]), bytes, `ZIP content differs: ${file}`);
  }

  const zipName = `${basename}.zip`;
  copyFileSync(tarball, path.join(outDir, packed.filename));
  writeFileSync(path.join(outDir, zipName), zipBytes);
  const checksums = [[packed.filename, tarBytes], [zipName, zipBytes]]
    .map(([file, bytes]) => `${createHash("sha256").update(bytes).digest("hex")}  ${file}`)
    .join("\n") + "\n";
  writeFileSync(path.join(outDir, "SHA256SUMS"), checksums);
  console.log(`Verified ${required.length} files in the npm package and matching ZIP.`);
  console.log(`release/${packed.filename} (${tarBytes.length} bytes)`);
  console.log(`release/${zipName} (${zipBytes.length} bytes)`);
  console.log("release/SHA256SUMS");
} finally {
  // Only remove the temporary child this invocation created, never the output directory.
  assert.equal(path.dirname(path.resolve(staging)), path.resolve(outDir));
  assert(path.basename(staging).startsWith(".pack-"));
  rmSync(staging, { recursive: true, force: true });
}
