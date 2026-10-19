# Releasing opencode-tui-context

Users install the same prebuilt npm package on both hosts: `opencode plugin -g opencode-tui-context@<version>` in V1, or `opencode plugin add opencode-tui-context@<version>` in V2. GitHub Releases provide a ZIP for manual installation. Both downloads come from the same checked package contents; users do not need Bun or a compiler.

Version `2.1.1` supports OpenCode V1 `>=1.18.31 <2` and V2 `>=2.0.32 <3` in one package. Validate both host baselines (`1.18.31` and `2.0.32`) before publication. Published `1.0.1` remains an optional V1 fallback; V1 users do not need a separate current package version. A matching release tag starts publication.

## What the workflows do

[CI](../.github/workflows/ci.yml) checks pull requests and pushes to `main` on Ubuntu and Windows. Each runner installs the frozen Bun lockfile, checks types, runs unit tests and `bun run test:render`, then builds and verifies the release archives. The workflow retains installable artifacts for 14 days.

[Release](../.github/workflows/release.yml) runs when a `v*` tag is pushed. It:

1. Requires a stable `vX.Y.Z` tag matching `package.json` exactly. Prereleases and build metadata are deliberately rejected; this workflow publishes to npm's `latest` channel.
2. Runs the same checks and packaging on Ubuntu and Windows, saving artifacts for 30 days.
3. Publishes the exact verified Ubuntu `.tgz` to npm using OIDC, after checking whether that version already exists.
4. Creates a GitHub Release and attaches the `.tgz`, manual-install `.zip`, and `SHA256SUMS`. The release stays a draft until all attachments are present.

The build jobs have read-only repository permissions. Only the npm job can request an OIDC token; only the GitHub Release job can write release assets. No `NPM_TOKEN` secret is needed. Actions are pinned to commit SHAs, and the toolchain is Node.js `24.21.0`, npm `11.19.1`, and Bun `1.4.2`. Keep these versions aligned across both workflows when updating them.

## One-time npm setup

The package name is `opencode-tui-context`, and its repository metadata identifies `SolitudeRA/opencode-tui-context`. The maintainer needs ownership of that npm name. If the name is already owned by someone else, resolve that before publishing; changing the name also requires updating the workflows and installation docs.

In the package's npm **Settings → Trusted publishing**, add a GitHub Actions publisher with these exact values:

| Field | Value |
| --- | --- |
| Organization or user | `SolitudeRA` |
| Repository | `opencode-tui-context` |
| Workflow filename | `release.yml` |
| Environment name | Leave empty; this workflow does not use a GitHub environment |
| Allowed actions | Allow direct `npm publish` |

New trusted-publisher configurations can default to staged publishing. This workflow uses direct publishing, so explicitly allow `npm publish`. The npm documentation requires GitHub-hosted runners, Node.js `>=22.14.0`, and npm `>=11.5.1`; the pinned toolchain meets those requirements. Public packages published from public GitHub repositories through OIDC receive provenance automatically. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for setup and troubleshooting.

### Compatibility and release boundary

Reuse the existing package name and verify the trusted publisher before pushing the tag. The stable workflow publishes to `latest`; keep both host installation commands and their distinct configuration formats in all three READMEs and user guides. The universal entry must lazily load only the selected adapter. Do not move existing public tags, even when their workflow failed before npm publication.

Before an approved publication, update all three READMEs and user guides for the target version, removing any temporary prerelease notices. Regenerate and review the archives from that exact commit. Document completed checks separately from checks still pending; package validation does not establish registry installation or interactive acceptance.

## Prepare a release

Update `package.json` to an unused stable version and refresh `bun.lock` if required. Keep the three README translations aligned with the actual installation experience. Review the changes, then run:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
bun run test:render
npm run release:pack
```

`test:render` builds `dist/tui.js`, `dist/tui-v1.js`, and `dist/tui-v2.js`, then runs `scripts/test-entrypoints.mjs` and both renderer checks (`scripts/test-render.mjs` for V2, `scripts/test-render-v1.mjs` for V1). The entrypoint check verifies lazy adapter loading and isolation from the other host SDK. Renderer checks use the matching native OpenTUI version with mocked host contexts. They exercise usage, reactive updates, active-context boundaries, layout, themes, and cleanup without model requests or launching OpenCode; actual host loading is a separate check.

OpenCode supplies its SDK, OpenTUI, and Solid at runtime. Keep them in `devDependencies` only and retain the supported host range in `engines.opencode`. Do not add runtime dependencies or peer dependencies for these host-provided modules: even optional peers can trigger resolution of both SDKs and incompatible transitive renderer versions during installation.

`release:pack` rebuilds the bundles, checks the package file list, npm `./tui` export, and root `tui.js` entry, then runs a normal npm install of the tarball in a clean temporary project. This uses the public npm registry with fresh configuration and an empty cache, disables scripts, audit, and funding requests, and verifies that only the plugin is installed. Do not replace it with `--offline`: npm can skip missing optional-peer metadata in that mode and miss the original dependency-resolution failure. Unpacking an archive and loading a local directory cannot exercise this resolver path; native registry installation still needs a post-publication check on both hosts. It creates:

```text
release/
├── opencode-tui-context-<version>.tgz
├── opencode-tui-context-<version>.zip
└── SHA256SUMS
```

The `.tgz` is the npm package. The ZIP contains a top-level `opencode-tui-context/` directory with ten files: `package.json`, the root `tui.js`, three `dist/` files (`tui.js`, `tui-v1.js`, `tui-v2.js`), `LICENSE`, three READMEs, and the preview SVG. Preserve the root entry and both adapters; npm uses the manifest's `./tui` export, and both entry paths reach the universal bundle. Source code, tests, build tools, and `node_modules` are not needed by users. Do not hand-edit the archives or publish from an unchecked working directory. The workflow publishes the already-verified tarball with lifecycle scripts disabled, avoiding a second build at publication time.

Before releasing, extract the ZIP and run both isolated host smoke checks against that same package directory:

```sh
node scripts/smoke-host-v1.mjs --package=/absolute/path/to/opencode-tui-context --opencode=/absolute/path/to/opencode-v1
node scripts/smoke-host.mjs --package=/absolute/path/to/opencode-tui-context --opencode=/absolute/path/to/opencode-v2
```

Run the helpers in an interactive terminal with the matching host executable. They isolate configuration and install the unpacked release away from development dependencies. Use synthetic session fixtures to check visible usage and empty states, revert behavior, responsive layout, and plugin lifecycle. Record the exact host version, package hashes, exercised scenarios, and any skipped checks. Local-package loading and fixtures do not establish npm registry installation or real-provider usage. CI does not launch the interactive host helpers.

On each host version, also check the panel interactively in a separate OpenCode configuration: load the extracted directory, restart OpenCode, open the sidebar, and check an empty session and a session with reported token usage. Exercise reactive updates, switching sessions and models, revert/unrevert, completed compaction, narrow widths, theme changes, and plugin disposal. Check coexistence with the existing sidebar. If using imported fixtures or a local test provider, record that separately from real-provider validation. Passing package checks and plugin activation does not establish that every rendered state is correct.

Commit the version, docs, and lockfile changes. Wait for CI to pass, then create and push the matching tag. For example, when the committed version is `2.1.1`:

```sh
git tag -a v2.1.1 -m "Release 2.1.1"
git push origin v2.1.1
```

Pushing the tag starts external publication. Check the target commit and version before running these commands. The workflow does not bump versions, commit changes, or create tags for you.

## Verify the published install

After the release succeeds, use separate clean configurations for both host versions:

| Host | Install command | Expected entry |
| --- | --- | --- |
| V1 | `opencode plugin -g opencode-tui-context@2.1.1` | `tui.json` → `plugin` |
| V2 | `opencode plugin add opencode-tui-context@2.1.1` | `cli.json` → `plugins` |

Restart OpenCode and repeat the host checks above. Confirm that the published version resolves from npm, its entry is in the matching host configuration, and the panel renders after a response reports usage. Download the GitHub ZIP as well, verify `SHA256SUMS`, and confirm its manual-install layout. Open the [npm package page](https://www.npmjs.com/package/opencode-tui-context) and check that the README, preview image, and links render correctly; including an image in the archive does not itself verify npm's page rendering. Record the OpenCode version and operating system used in the release notes, distinguishing tested hosts from the broader declared compatibility range.

## Recover a failed release

- **Before npm publication:** fix the failed check. If the tagged source needs changes, use a new version and tag; do not move a public tag.
- **npm already contains the same archive:** rerun the failed jobs. The workflow compares npm's SHA-512 integrity with the saved `.tgz` and skips publication only on an exact match.
- **npm contains different bytes for that version:** the workflow stops. Inspect the discrepancy and release a new version. npm versions cannot be overwritten; do not bypass the integrity check.
- **GitHub Release upload failed:** rerun the failed jobs while the workflow artifact is retained. Existing attachments are downloaded and compared before missing ones are uploaded; different attachments cause failure rather than being replaced.
- **Authentication failed:** check the exact repository, workflow filename, direct-publish permission, npm ownership, and OIDC job permission. Do not add a long-lived write token as a workaround.

Prefer rerunning only failed jobs so the verified build artifacts are reused. Rerunning all jobs rebuilds with the pinned toolchain and still requires an exact match with any existing npm version. If artifacts have expired, the same tag can be rebuilt by rerunning all jobs; investigate any integrity difference instead of forcing publication.

For incorrect behavior discovered after publication, prepare a patch version. Do not unpublish or rewrite an existing release as part of the normal recovery path.
