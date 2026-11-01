# Optional storage rename

The public name is pi-noodle. Existing installations keep using their old paths
without migration. Commands and tools retain compatibility aliases.

The optional `pi-noodle-migrate` utility copies selected storage to noodle-named
paths, verifies the copies, then publishes a layout marker. It never deletes the
originals or enables memory, archive capture, watchers or model access.

## Before running

- Back up the selected Pi agent directory and project settings.
- Stop **every** Pi instance using that directory. Run the utility outside Pi.
  `--confirm-stopped` is your assertion, not process detection or a sandbox.
- Encrypted archives need a ready vault and an existing remembered unlock.
  If necessary, explicitly select remembered unlock in the old installation
  before stopping Pi. The utility never accepts a password in arguments,
  environment variables or ordinary terminal input.
- Do not load the old and new extensions together. Restart only with pi-noodle
  after successful migration. Old versions ignore the marker and would write to
  the retained old copies.

## Review, then apply

Use an absolute path to **one** agent directory. No directory is guessed or scanned
outside the root you select. From a built checkout, replace `pi-noodle-migrate`
with `node dist/storage-migration.js`.

```sh
pi-noodle-migrate preview /absolute/agent-directory agent --confirm-stopped
pi-noodle-migrate apply /absolute/agent-directory agent --confirm-stopped --confirm-sensitive --review HASH_FROM_PREVIEW
```

The review hash covers the exact file set, identities, metadata and content.
Changed sources or existing new-name destinations refuse rather than merge or
overwrite. Preview hashes files, so it also requires stopped instances.

Project config files are a **separate explicit operation**. Repeat the same commands
with an absolute project root and `project` instead of `agent`. No project scan or
project-control changes are automatic. Agent migration does not migrate settings
in other projects or agent directories.

## What changes

Agent mode copies the three global config files, memory and archive directories,
and side-session directory. Project mode copies the three `.pi` config files.
Each root activates independently through its own `pi-noodle-layout.json` marker.
Noodle then reads and writes the selected new names, without merging old copies.
Saved main-session references are translated in memory to the new side directory;
original Pi transcripts are not rewritten.

For an encrypted active archive, the existing remembered key authenticates the
copied database. The key is copied to the new OS service and read back for
verification. The old credential remains. The OS may require authorization;
missing credentials or native dependencies fail closed. No real OS credential
backend was used during automated validation.

Historical text, database schemas and record identities, custom-entry type tags,
and authenticated cryptographic format tags remain unchanged. Those are data
formats, not branding. This is **not** a global replacement of every old word.

## Failure and retained copies

A failed apply leaves its pending manifest and any partial copies for inspection.
There is no automatic retry, uncertain-write replay, merge, cleanup or repair.
Publication may already have succeeded: inspect the layout marker and pending
manifest before restarting. Do not delete arbitrary files to bypass a refusal.

Original files and old credentials are retained as recovery material. Automatic
rollback is not provided. Once new sessions write to the new locations, reverting
to the originals would omit those new records and requires a deliberate recovery
plan. Disk space is needed for both copies; retained plaintext stays plaintext.

Validation used synthetic configs, memory, plaintext/encrypted archives and fake
keychains on Linux. It checked actual new-runtime reads after migration and
refusal of a stale review. Crash recovery, real OS credentials, concurrent hostile
filesystem changes and other platforms have not been validated. The copy and
metadata checks are not an immutable filesystem snapshot or forensic erasure.
