# Rename migration rehearsal

Historical feasibility-stage results. Current release gates are recorded in
[rename-release-report.md](rename-release-report.md); the implemented offline utility
is documented in [storage-migration.md](storage-migration.md).

The synthetic relocation test passed. This is not a production migration command,
not validation of the renamed extension, and not permission to migrate real data.

## Gate

`node --import tsx --test test/rename-migration.test.ts`

- Corrected run: 1 test, 1 pass, 0 failures, 0 skips; exit 0.
- Planted fault: `NOODLE_REHEARSAL_DROP_KEY=1` omitted the copied remembered key.
  The same test failed with `migration lost remembered key at the new service`;
  exit 1. The test detected the intended fault.
- The earlier repository-local run failed before that fault: archive ancestry
  permissions were unsafe. No archive security checks were weakened. Marc approved
  disposable scratch under `/srv/pi-noodle-migration-test`; fixture children are
  removed after each run.

## What passed

Existing 1.14 code wrote synthetic configs, memory and plaintext/encrypted archive
records. An explicit test-only manifest copied them to noodle-named locations.
The checks compared exact facts, raw archive JSON, full-text search results,
config bytes, side-conversation bytes and the updated side-session reference.
The watcher snapshot was retained unchanged; no watcher command was executed.

An in-memory credential backend exercised the real key encoding/validation while
copying a remembered key from the old service identity to the new one. Both
remembered-key and password unlock returned the same data key. Original files
remained byte-identical, and the original remembered key remained available.
No real Pi directories, credentials, providers or MCP servers were accessed.

## Not proved yet

- No production migration API, preview, lock, publication or recovery mechanism.
- No renamed-runtime reader or command/tool alias validation; database reads used
  SQLite directly at the copied paths. Session references used the old reader.
- No interrupted copy, concurrent writer, conflicting destination, large archive,
  multiple-agent-directory, OS-keychain or cross-platform validation.
- No full test suite, release build, commit, tag or push for this work.

Authenticated envelope/vault tags, SQL lane values and saved custom-entry types
still use legacy identifiers. Simply replacing the envelope format name is
rejected even with the correct password. Changing those internal formats needs
an explicit compatible format conversion, not a text replacement. Historical
conversation text must not be rewritten.
