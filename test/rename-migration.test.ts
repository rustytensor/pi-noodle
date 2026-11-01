import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { MemoryStore } from "../memory-store.js";
import { ArchiveStore } from "../archive-store.js";
import { createArchiveEnvelope, unlockArchiveEnvelope } from "../archive-crypto.js";
import { NativeArchiveKeychain, type ArchiveKeychainEntryFactory } from "../archive-keychain.js";
import { ArchiveVaultFiles, type VaultReady } from "../archive-vault-files.js";
import { openEncryptedArchiveDatabase, type ArchiveDatabase } from "../archive-sqlite.js";
import { saveNoodleModelSelectionSetting } from "../noodle-config.js";
import { createNoodleSessionRef, readNoodleSessionRef, NOODLE_SESSION_REF_CUSTOM_TYPE } from "../session-ref.js";
import { WATCHER_STATE_TYPE } from "../watchers-types.js";

/**
 * Feasibility rehearsal ONLY, not a production migration command or renamed runtime.
 * All data paths are generated under the approved private scratch directory; credentials are fake.
 * Existing 1.14 writers create the databases. Only closed, fixture-owned files are
 * copied. Raw history, SQL schema/identities and authenticated format tags stay intact.
 * A shipping migrator still needs preview, locking, crash recovery, old/new path
 * resolution and a real-keychain opt-in. Never point this helper at user data.
 */
const FACT = "The fictional jarvis observatory has 17 blue chairs.";
const PASSWORD = "synthetic migration rehearsal password";
const OLD_SERVICE = "pi-jarvis-archive";
const NEW_SERVICE = "pi-noodle-archive";
const CONFIG = { mode: "pinned", provider: "fixture-provider", modelId: "fixture-model" } as const;

function digest(path: string): string {
	return createHash("sha256").update(fs.readFileSync(path)).digest("hex");
}
function put(path: string, data: unknown): void {
	fs.mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	fs.writeFileSync(path, JSON.stringify(data) + "\n", { flag: "wx", mode: 0o600 });
}
function readJson(path: string): any { return JSON.parse(fs.readFileSync(path, "utf8")); }
function inventory(root: string): Record<string, string> {
	const result: Record<string, string> = {};
	function visit(relative: string): void {
		for (const entry of fs.readdirSync(join(root, relative), { withFileTypes: true })) {
			const name = join(relative, entry.name);
			assert.ok(!entry.isSymbolicLink(), "fixture must not contain symlinks");
			if (entry.isDirectory()) visit(name);
			else { assert.ok(entry.isFile()); result[name] = digest(join(root, name)); }
		}
	}
	visit(""); return result;
}
function archiveFacts(db: ArchiveDatabase, raw: string): void {
	assert.equal(db.prepare("SELECT count(*) AS n FROM records").get()?.n, 1);
	assert.equal(db.prepare("SELECT raw_json FROM records").get()?.raw_json, raw);
	assert.equal(db.prepare("SELECT lane FROM records").get()?.lane, "jarvis");
	assert.equal(db.prepare("SELECT count(*) AS n FROM records_fts WHERE records_fts MATCH ?").get("observatory")?.n, 1);
}

test("offline rename rehearsal preserves configs, facts, raw archives, references and remembered unlock", async (t) => {
	// No os.tmpdir(), home-directory lookup, credential enumeration or live Pi APIs.
	const root = fs.mkdtempSync("/srv/pi-noodle-migration-test/rehearsal-");
	fs.chmodSync(root, 0o700);
	const old = join(root, "old"), target = join(root, "candidate");
	const agent = join(old, "agent"), plainAgent = join(old, "plain-agent"), project = join(old, "project");
	const credentials = new Map<string, string>();
	const handles: Array<{ close(): void }> = [];
	const ownedKeys: Buffer[] = [];
	t.after(() => {
		for (const handle of handles.reverse()) handle.close();
		for (const key of ownedKeys) key.fill(0);
		credentials.clear();
		fs.rmSync(root, { recursive: true, force: true });
	});
	// NativeArchiveKeychain's real encoding/validation, but never its native factory.
	const fakeFactory: ArchiveKeychainEntryFactory = (service, account) => ({
		async getPassword() { return credentials.get(`${service}/${account}`); },
		async setPassword(value) { credentials.set(`${service}/${account}`, value); },
		async deleteCredential() { return credentials.delete(`${service}/${account}`); },
	});
	const oldKeys = new NativeArchiveKeychain(fakeFactory);
	const newKeys = new NativeArchiveKeychain((_service, account, options) => fakeFactory(NEW_SERVICE, account, options));
	const account = createHash("sha256").update("synthetic remembered migration account").digest("hex");

	fs.mkdirSync(project, { recursive: true, mode: 0o700 });
	saveNoodleModelSelectionSetting(project, "global", CONFIG, agent);
	saveNoodleModelSelectionSetting(project, "project", CONFIG, agent);
	const archiveConfig = { archive: { enabled: true, capture: false, modelAccess: false } };
	const watcherConfig = { watchers: { enabled: false } };
	for (const [suffix, config] of [["archive", archiveConfig], ["watchers", watcherConfig]] as const) {
		put(join(agent, "extensions", `pi-jarvis-${suffix}.json`), config);
		put(join(project, ".pi", `jarvis-${suffix}.json`), config);
	}
	const memory = new MemoryStore(agent); handles.push(memory);
	const saved = memory.save({ kind: "note", category: "reference", scope: "project", project,
		title: "Synthetic observatory", text: FACT, source: { lane: "jarvis", sessionId: "side-fixture", eventId: "note-fixture" } });
	assert.equal(saved.outcome, "saved");
	const memoryId = saved.record!.id;
	memory.close();

	const entry = { id: "message-fixture", parentId: null, type: "message", timestamp: "2026-01-02T03:04:05.000Z",
		message: { role: "assistant", content: FACT } };
	const input = { project, sessionId: "side-fixture", lane: "jarvis" as const, entry };
	const raw = JSON.stringify(entry);
	const plain = new ArchiveStore(plainAgent); handles.push(plain);
	assert.equal(plain.append(input), "saved"); plain.close();
	const material = await createArchiveEnvelope(PASSWORD); ownedKeys.push(material.key);
	const state: VaultReady = { format: "pi-jarvis-archive-vault", version: 1, phase: "ready", revision: randomUUID(),
		active: { id: material.envelope.vaultId, envelope: material.envelope }, retired: [], startup: "remember", remember: { account } };
	new ArchiveVaultFiles(agent).withLock(locked => { locked.write(state); locked.ensureStorageDir(state.active.id); });
	const encrypted = new ArchiveStore(agent, { managed: true, storageId: state.active.id,
		databaseFactory: (path, options) => openEncryptedArchiveDatabase(path, material.key, options) }); handles.push(encrypted);
	assert.equal(encrypted.append(input), "saved"); encrypted.close();
	await oldKeys.set(account, material.key);
	assert.ok(credentials.has(`${OLD_SERVICE}/${account}`), "legacy writer must use the original service");

	const sideRelative = "agent/jarvis-sessions/fixture.jsonl";
	const newSideRelative = "agent/noodle-sessions/fixture.jsonl";
	const sidePath = join(old, sideRelative);
	fs.mkdirSync(dirname(sidePath), { recursive: true, mode: 0o700 });
	const sideText = JSON.stringify({ type: "session", version: 3, id: "side-fixture", timestamp: entry.timestamp, cwd: project }) + "\n" + raw + "\n";
	fs.writeFileSync(sidePath, sideText, { flag: "wx", mode: 0o600 });
	const watcher = { version: 1, id: "watcher-fixture", sessionId: "main-fixture", cwd: project,
		label: "Fixture watcher", note: FACT, condition: { kind: "command", command: "exit 1" }, command: "exit 1",
		createdAt: 1000, deadline: 61000, intervalSeconds: 10, checkTimeoutSeconds: 1, outputTailChars: 500,
		maxDirectoryEntries: 2000, state: "cancelled", detail: "synthetic saved watcher", output: "", omitted: false };
	const branch = [
		{ type: "custom", customType: NOODLE_SESSION_REF_CUSTOM_TYPE, data: createNoodleSessionRef(sidePath) },
		{ type: "custom", customType: WATCHER_STATE_TYPE, data: { version: 1, records: [watcher] } },
	];
	put(join(old, "branch.json"), branch);
	const original = inventory(old);

	// Explicit manifest, not a recursive replacement of names/content in user files.
	const manifest = [
		["agent/extensions/pi-jarvis.json", "agent/extensions/pi-noodle.json"],
		["agent/extensions/pi-jarvis-archive.json", "agent/extensions/pi-noodle-archive.json"],
		["agent/extensions/pi-jarvis-watchers.json", "agent/extensions/pi-noodle-watchers.json"],
		["project/.pi/jarvis.json", "project/.pi/noodle.json"],
		["project/.pi/jarvis-archive.json", "project/.pi/noodle-archive.json"],
		["project/.pi/jarvis-watchers.json", "project/.pi/noodle-watchers.json"],
		["agent/extensions/pi-jarvis-memory", "agent/extensions/pi-noodle-memory"],
		["agent/extensions/pi-jarvis-archive", "agent/extensions/pi-noodle-archive"],
		["plain-agent/extensions/pi-jarvis-archive", "plain-agent/extensions/pi-noodle-archive"],
		[sideRelative, newSideRelative],
	] as const;
	assert.equal(fs.existsSync(target), false);
	fs.mkdirSync(target, { mode: 0o700 });
	for (const [from, to] of manifest) {
		const destination = join(target, to);
		fs.mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
		fs.cpSync(join(old, from), destination, { recursive: true, errorOnExist: true, force: false });
	}
	const copiedBranch = JSON.parse(JSON.stringify(branch));
	copiedBranch[0].data.file = join(target, newSideRelative);
	put(join(target, "branch.json"), copiedBranch);
	const remembered = await oldKeys.get(account);
	assert.ok(remembered, "source remembered key must exist"); ownedKeys.push(remembered);
	// Deliberately omit this write for the gate's planted-fault run.
	if (process.env.NOODLE_REHEARSAL_DROP_KEY !== "1") await newKeys.set(account, remembered);

	for (const [from, to] of manifest) {
		if (fs.statSync(join(old, from)).isFile()) assert.equal(digest(join(target, to)), original[from]);
		else assert.deepEqual(inventory(join(target, to)), inventory(join(old, from)));
	}
	assert.deepEqual(readJson(join(target, "agent/extensions/pi-noodle.json")).modelSelection, CONFIG);
	assert.deepEqual(readJson(join(target, "project/.pi/noodle.json")).modelSelection, CONFIG);
	assert.deepEqual(readJson(join(target, "agent/extensions/pi-noodle-archive.json")), archiveConfig);
	assert.deepEqual(readJson(join(target, "agent/extensions/pi-noodle-watchers.json")), watcherConfig);
	const memoryDb = new DatabaseSync(join(target, "agent/extensions/pi-noodle-memory/memory.sqlite"), { readOnly: true });
	try {
		assert.equal(memoryDb.prepare("SELECT text FROM records WHERE id=?").get(memoryId)?.text, FACT);
		assert.equal(memoryDb.prepare("SELECT lane FROM records WHERE id=?").get(memoryId)?.lane, "jarvis");
		assert.equal(memoryDb.prepare("SELECT count(*) AS n FROM records_fts WHERE records_fts MATCH ?").get("observatory")?.n, 1);
	} finally { memoryDb.close(); }
	const plainDb = new DatabaseSync(join(target, "plain-agent/extensions/pi-noodle-archive/archive.sqlite"), { readOnly: true });
	try { archiveFacts(plainDb, raw); } finally { plainDb.close(); }
	const candidateKey = await newKeys.get(account);
	assert.ok(candidateKey, "migration lost remembered key at the new service"); ownedKeys.push(candidateKey);
	assert.ok(candidateKey.equals(material.key), "remembered key changed");
	const candidateDb = openEncryptedArchiveDatabase(join(target, "agent/extensions/pi-noodle-archive/vaults", state.active.id, "archive.sqlite"), candidateKey);
	try { archiveFacts(candidateDb, raw); } finally { candidateDb.close(); }
	const candidateState = readJson(join(target, "agent/extensions/pi-noodle-archive/archive.vault.json"));
	assert.deepEqual(candidateState, state);
	const passwordKey = await unlockArchiveEnvelope(candidateState.active.envelope, PASSWORD); ownedKeys.push(passwordKey);
	assert.ok(passwordKey.equals(candidateKey), "password unlock and remembered unlock must agree");
	// Authenticated format metadata cannot simply be renamed, even with a correct password.
	await assert.rejects(unlockArchiveEnvelope({ ...candidateState.active.envelope, format: "pi-noodle-archive-key" }, PASSWORD));
	const reference = readNoodleSessionRef(readJson(join(target, "branch.json")));
	assert.equal(reference?.file, join(target, newSideRelative));
	assert.equal(fs.readFileSync(reference!.file, "utf8"), sideText);
	assert.deepEqual(readJson(join(target, "branch.json"))[1], branch[1]);
	assert.deepEqual(inventory(old), original, "original files must remain byte-identical for rollback");
	const retainedKey = await oldKeys.get(account); assert.ok(retainedKey); ownedKeys.push(retainedKey);
	assert.ok(retainedKey.equals(material.key), "original remembered key must remain available for rollback");
});
