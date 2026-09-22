# Releasing opencode-tui-context

Users should install the prebuilt npm package with `opencode plugin -g opencode-tui-context`. GitHub Releases provide a ZIP for manual installation. Both downloads come from the same checked package contents; users do not need Bun or a compiler.

The repository contains the release machinery, but adding these files does not publish a package or configure npm. Complete the one-time npm setup before expecting tag releases to succeed.

## What the workflows do

[CI](../.github/workflows/ci.yml) checks pull requests and pushes to `main` on Ubuntu and Windows. Each runner installs the frozen Bun lockfile, checks types, runs tests, and builds and verifies the release archives. The workflow retains installable artifacts for 14 days.

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

### If the npm package does not exist yet

Trusted publishing is configured in an existing package's settings. Bootstrap the first real version with an interactive maintainer login, then configure the publisher above. See npm's [first-publication guide](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/).

1. When actually preparing the first publication, remove the temporary "npm package is not published yet" notice from all three READMEs, then regenerate and verify the archives. Commit and push those reviewed release changes to `main`, and wait for both CI jobs to pass. For the first release using this workflow, the prepared version is `1.0.1`; the existing `v1.0.0` tag must not be moved or reused. The CI artifact and eventual tag must come from this same commit.
2. Download and extract the **`package-ubuntu-latest`** artifact from that exact CI run. Use its `.tgz` unchanged, so the initial npm publication and the subsequent tag workflow can compare identical bytes.
3. Verify the downloaded checksums. On Linux/macOS, run `shasum -a 256 -c SHA256SUMS` inside the extracted artifact. On PowerShell, compare `Get-FileHash .\opencode-tui-context-1.0.1.tgz -Algorithm SHA256` with the matching line in `SHA256SUMS`.
4. From the extracted artifact directory, authenticate and publish:

   ```sh
   npm login --registry=https://registry.npmjs.org
   npm publish ./opencode-tui-context-1.0.1.tgz --access public --tag latest --ignore-scripts --registry=https://registry.npmjs.org
   ```

   Complete npm's interactive authentication and 2FA prompts. Keep credentials out of the repository, workflow, and command arguments. A local bootstrap publish does not receive the workflow's automatic OIDC provenance.

5. Configure the trusted publisher in npm, then tag the **same commit** as described below. The workflow recognizes the identical existing npm archive and proceeds to create the GitHub Release. Future new versions use OIDC publishing automatically.

If a tag workflow was started before bootstrap and failed at npm authentication, its **`release-ubuntu-latest`** artifact can be used instead. Publish that exact archive, configure the trusted publisher, and rerun the failed jobs.

## Prepare a release

Update `package.json` to an unused stable version and refresh `bun.lock` if required. Keep the three README translations aligned with the actual installation experience. Review the changes, then run:

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
npm run release:pack
```

`release:pack` rebuilds the bundle before packing and checks the package's file list and `./tui` entry point. It creates:

```text
release/
├── opencode-tui-context-<version>.tgz
├── opencode-tui-context-<version>.zip
└── SHA256SUMS
```

The `.tgz` is the npm package. The ZIP contains a top-level `opencode-tui-context/` directory with `package.json`, `dist/tui.js`, license, README files, and documentation assets. Source code, tests, build tools, and `node_modules` are not needed by users. Do not hand-edit the archives or publish from an unchecked working directory. The workflow publishes the already-verified tarball with lifecycle scripts disabled, avoiding a second build at publication time.

Before releasing, extract the ZIP and run the isolated host smoke check against that package directory:

```sh
node scripts/smoke-host.mjs --package=/absolute/path/to/opencode-tui-context --opencode=/absolute/path/to/opencode
```

Run the helper in an interactive terminal; it requires a TTY and an installed OpenCode host. It creates a temporary isolated configuration and checks that the real OpenCode TUI activates the packaged plugin, without model calls. It records activation evidence and the bundle's SHA-256 in `host-evidence.json` at the printed temporary path. This verifies module loading and activation, not npm registry installation or the rendered sidebar. The CI workflows do not claim interactive host acceptance.

Also check the panel interactively in a separate OpenCode configuration: load the extracted directory, restart OpenCode, open the sidebar, and check an empty session and a session with reported token usage. Check narrow widths and coexistence with the built-in context panel. Passing package checks and plugin activation does not establish that every rendered state is correct.

Commit the version, docs, and lockfile changes. Wait for CI to pass, then create and push the matching tag. For example, when the committed version is `1.0.1`:

```sh
git tag -a v1.0.1 -m "Release 1.0.1"
git push origin v1.0.1
```

Pushing the tag starts external publication. Check the target commit and version before running these commands. The workflow does not bump versions, commit changes, or create tags for you.

## Verify the published install

After the release succeeds, use a clean OpenCode configuration to run:

```sh
opencode plugin -g opencode-tui-context
```

Restart OpenCode and repeat the host checks above. Confirm that the published version resolves from npm, the package appears in OpenCode's plugin manager, and the panel renders after a response reports usage. Download the GitHub ZIP as well, verify `SHA256SUMS`, and confirm its manual-install layout. Open the [npm package page](https://www.npmjs.com/package/opencode-tui-context) and check that the README, preview image, and links render correctly; including an image in the archive does not itself verify npm's page rendering. Record the OpenCode version and operating system used in the release notes, distinguishing tested hosts from the broader declared compatibility range.

## Recover a failed release

- **Before npm publication:** fix the failed check. If the tagged source needs changes, use a new version and tag; do not move a public tag.
- **npm already contains the same archive:** rerun the failed jobs. The workflow compares npm's SHA-512 integrity with the saved `.tgz` and skips publication only on an exact match.
- **npm contains different bytes for that version:** the workflow stops. Inspect the discrepancy and release a new version. npm versions cannot be overwritten; do not bypass the integrity check.
- **GitHub Release upload failed:** rerun the failed jobs while the workflow artifact is retained. Existing attachments are downloaded and compared before missing ones are uploaded; different attachments cause failure rather than being replaced.
- **Authentication failed:** check the exact repository, workflow filename, direct-publish permission, npm ownership, and OIDC job permission. Do not add a long-lived write token as a workaround.

Prefer rerunning only failed jobs so the verified build artifacts are reused. Rerunning all jobs rebuilds with the pinned toolchain and still requires an exact match with any existing npm version. If artifacts have expired, the same tag can be rebuilt by rerunning all jobs; investigate any integrity difference instead of forcing publication.

For incorrect behavior discovered after publication, prepare a patch version. Do not unpublish or rewrite an existing release as part of the normal recovery path.
