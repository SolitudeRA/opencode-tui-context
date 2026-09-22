import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  "docs/assets/context-preview.svg",
  "package.json",
].sort();
const outDir = path.join(root, "release");
mkdirSync(outDir, { recursive: true });
const staging = mkdtempSync(path.join(outDir, ".pack-"));

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", windowsHide: true });
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${path.basename(command)} failed:\n${result.stdout}`);
  return result.stdout;
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
  assert.equal(Object.keys(shipped.dependencies ?? {}).length, 0, "Unexpected runtime dependencies.");
  assert(files["dist/tui.js"].length > 0, "The TUI entry is empty.");

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
