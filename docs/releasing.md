# Releasing opencode-tui-context

Users should install the prebuilt npm package with `opencode plugin add opencode-tui-context@<version>`. GitHub Releases provide a ZIP for manual installation. Both downloads come from the same checked package contents; users do not need Bun or a compiler.

The `2.x` series targets OpenCode V2 (`>=2.0.32 <3`). Published `1.0.1` remains the V1 release. Do not move its tag or ask V1 users to install the V2 bundle. A matching release tag starts publication.

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

### V2 release boundary

V2 releases reuse the existing package name; no bootstrap publication is needed. Verify the trusted publisher above before pushing the tag. The stable release workflow publishes to `latest`, so the release notes and all three READMEs must clearly direct V1 users to `opencode-tui-context@1.0.1` and its tagged documentation.

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

`test:render` rebuilds `dist/tui.js` and runs the built plugin in the real OpenTUI test renderer with a mocked V2 host context. Its nine scenario groups exercise empty state, reactive tokens, message-model lookup, session/location switching, revert boundaries, compaction, resizing, live theme colors, and cleanup. It makes no network requests and does not launch OpenCode, so it complements the host smoke check below.

`release:pack` rebuilds the bundle before packing and checks the package's file list, npm `./tui` export, and root `tui.js` entry for local directory loading. It creates:

```text
release/
├── opencode-tui-context-<version>.tgz
├── opencode-tui-context-<version>.zip
└── SHA256SUMS
```

The `.tgz` is the npm package. The ZIP contains a top-level `opencode-tui-context/` directory with eight files: `package.json`, the root `tui.js`, `dist/tui.js`, `LICENSE`, three READMEs, and the preview SVG. Preserve the root `tui.js` for local loading; npm uses the manifest's `./tui` export, and both resolve to the same bundle. Source code, tests, build tools, and `node_modules` are not needed by users. Do not hand-edit the archives or publish from an unchecked working directory. The workflow publishes the already-verified tarball with lifecycle scripts disabled, avoiding a second build at publication time.

Before releasing, extract the ZIP and run the isolated host smoke check against that package directory:

```sh
node scripts/smoke-host.mjs --package=/absolute/path/to/opencode-tui-context --opencode=/absolute/path/to/opencode
```

Run the helper in an interactive terminal; it requires a TTY and OpenCode V2. It copies the unpacked release away from development dependencies and creates isolated home, configuration, cache, and data directories. It imports synthetic sessions, checks the rendered sidebar's known `20% used` snapshot and empty state, exercises the real revert/clear APIs, checks narrow/wide terminal visibility, and disables/re-enables the plugin through `cli.json`. No external model is called. It records the rendered text, session snapshots, host version, and bundle SHA-256 in `host-evidence.json` at the printed temporary path. This verifies local-package loading and fixture behavior; npm registry installation and real-provider usage are separate checks. The CI workflows do not launch this interactive helper.

Also check the panel interactively in a separate OpenCode configuration: load the extracted directory, restart OpenCode, open the sidebar, and check an empty session and a session with reported token usage. Exercise reactive updates, switching sessions and models, revert/unrevert, completed compaction, narrow widths, theme changes, and plugin disposal. Check coexistence with the existing sidebar. If using imported fixtures or a local test provider, record that separately from real-provider validation. Passing package checks and plugin activation does not establish that every rendered state is correct.

Commit the version, docs, and lockfile changes. Wait for CI to pass, then create and push the matching tag. For example, when the committed version is `2.0.0`:

```sh
git tag -a v2.0.0 -m "Release 2.0.0"
git push origin v2.0.0
```

Pushing the tag starts external publication. Check the target commit and version before running these commands. The workflow does not bump versions, commit changes, or create tags for you.

## Verify the published install

After the release succeeds, use a clean OpenCode configuration to run:

```sh
opencode plugin add opencode-tui-context@2.0.0
```

Restart OpenCode and repeat the host checks above. Confirm that the published version resolves from npm, its CLI-only entry is in `cli.json`, and the panel renders after a response reports usage. Download the GitHub ZIP as well, verify `SHA256SUMS`, and confirm its manual-install layout. Open the [npm package page](https://www.npmjs.com/package/opencode-tui-context) and check that the README, preview image, and links render correctly; including an image in the archive does not itself verify npm's page rendering. Record the OpenCode version and operating system used in the release notes, distinguishing tested hosts from the broader declared compatibility range.

## Recover a failed release

- **Before npm publication:** fix the failed check. If the tagged source needs changes, use a new version and tag; do not move a public tag.
- **npm already contains the same archive:** rerun the failed jobs. The workflow compares npm's SHA-512 integrity with the saved `.tgz` and skips publication only on an exact match.
- **npm contains different bytes for that version:** the workflow stops. Inspect the discrepancy and release a new version. npm versions cannot be overwritten; do not bypass the integrity check.
- **GitHub Release upload failed:** rerun the failed jobs while the workflow artifact is retained. Existing attachments are downloaded and compared before missing ones are uploaded; different attachments cause failure rather than being replaced.
- **Authentication failed:** check the exact repository, workflow filename, direct-publish permission, npm ownership, and OIDC job permission. Do not add a long-lived write token as a workaround.

Prefer rerunning only failed jobs so the verified build artifacts are reused. Rerunning all jobs rebuilds with the pinned toolchain and still requires an exact match with any existing npm version. If artifacts have expired, the same tag can be rebuilt by rerunning all jobs; investigate any integrity difference instead of forcing publication.

For incorrect behavior discovered after publication, prepare a patch version. Do not unpublish or rewrite an existing release as part of the normal recovery path.
