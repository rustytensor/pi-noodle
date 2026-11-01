# pi-noodle 1.15.0 validation

The release candidate passed its software gates. Real user data and OS credentials
were not migrated, and npm publication remains manual.

- A: `TMPDIR=/srv/pi-noodle-migration-test npm test` — 1,291 tests passed, 0 failed.
- B: compatibility fixtures use 14 files byte-identical to tag v1.14.0. Old configs,
  memory, plaintext/encrypted archives and remembered fake-key unlock remain usable.
  Old/new commands and memory search aliases work. Deliberately changing the
  keychain service failed at remembered unlock; the original identifier was restored.
- Migration: synthetic plaintext/encrypted copies were read through the new runtime
  paths; stale review refused, originals retained. No real OS keychain was used.
- C: source-name scan — 0 unexplained hits. 261 frozen-identifier lines excluded;
  53 explained hits are in `rename-remaining-hits.txt`, each with a one-word reason.
  Scope is tracked source plus new release files, not ignored historical notes,
  scratch output, dependencies or build output. Historical changelog entries,
  compatibility fixture sources and alias implementation are excluded.
- Final cosmetic QA-script and fixture-server renames passed the targeted native
  MCP/showcase checks. Release verification passed, including a fresh build and
  npm payload inspection. Secret-rule scan reported no matches.

The first full suite exposed 43 failures. The next attempt reduced that to one
alias-order assertion. The final assertion still checks host-tool order and exact
alias membership/multiplicity; only unspecified alias ordering is ignored. Archive
I/O and race safeguards were retained, not weakened. Layout selection is lazy and
owned by the service, outside the database-observation protocol.

Legacy data-format tags, lane values, record identities, old command/tool aliases
and GitHub repository URLs remain intentionally unchanged. Optional storage
migration is explicit, offline and conservative; see `storage-migration.md` for
its retained-copy, remembered-key and manual-recovery limitations.
