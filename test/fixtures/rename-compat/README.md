# Rename compatibility fixture (gate B)

Run: `node --import tsx --test test/rename-compat.test.ts`.
Main owns execution: first change `ARCHIVE_KEYCHAIN_SERVICE` deliberately, expect failure, restore it, then run the positive gate. This worker did not run tests or builds.

## Provenance

`v1.14.0/` contains 14 unmodified historical TypeScript files retrieved through Larra `read_file_at_point(project="pi-jarvis", point="v1.14.0")`, including their local runtime/type dependency closure. Each file was independently compared byte-for-byte with `git show v1.14.0:<path>`. `provenance.json` records the resolved commit, Larra point, and SHA-256 digests. These are actual old writers, not current writers renamed for the test. Keep them unchanged when changing the runtime. The historical `memory-service.ts` is included for the editor types' transitive type imports, not to run a historical provider.

`run.ts` supplies only synthetic inputs. Old config writers create global/project model and thinking settings, memory settings/disclosure and archive settings. Old stores create one curated note and one exact raw journal entry. Old crypto, SQLite and vault-file writers create an encrypted generation and Ready metadata. Old keychain serialization seeds a fake entry at the literal service `pi-jarvis-archive`; current `NativeArchiveKeychain` must retrieve it through its own service constant. The fake entry factory is injected on both sides: no native OS credential backend loads.

The encrypted fixture uses the old low-level writer APIs, with explicitly constructed synthetic Ready/remember metadata and the historical account hash formula. It does not drive the old interactive migration/password UI. It uses the already installed encrypted SQLite backend, with no download, installation or skip fallback.

## Expected results and boundary

The new runtime must recover the exact model/thinking selections, capture/recall controls, note title/body/provenance and raw archive JSON (including Unicode), from the old paths directly. Encrypted startup must unlock from the remembered fake entry without prompting. A changed keychain service fails before the success marker. Old and new memory search names return the exact same known fact. The actual main extension's `/jarvis` and `/noodle` non-TUI handlers must refuse hidden boot, with the legacy alias notice. Legacy tool declarations remain hidden through `prepareLoadout` but execute normally.

The parent launches an environment-allowlisted child; HOME, agent directory and temporary paths are private synthetic directories under the process temporary root (local validation used `/srv/pi-noodle-migration-test`). Providers/host tool execution are throwing fakes. No real settings, models, journals, memory or credentials are loaded. No automatic migration is performed: path/name compatibility is the gate. Interactive overlay behavior, real providers, OS credential integration and explicit future migration are outside this fixture.
