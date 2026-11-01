import assert from "node:assert/strict";
import fs from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { previewStorageMigration, applyStorageMigration } from "../storage-migration.js";
import { migratedLayout, layoutMarker } from "../storage-layout.js";
import { MemoryStore } from "../memory-store.js";
import { ArchiveStore } from "../archive-store.js";
import { createArchiveEnvelope } from "../archive-crypto.js";
import { ArchiveVaultFiles, type VaultReady } from "../archive-vault-files.js";
import { NativeArchiveKeychain, type ArchiveKeychainEntryFactory } from "../archive-keychain.js";
import { openEncryptedArchiveDatabase } from "../archive-sqlite.js";
import { saveNoodleModelSelectionSetting, loadNoodleModelSelectionSetting } from "../noodle-config.js";
import { readNoodleSessionRef, createNoodleSessionRef, NOODLE_SESSION_REF_CUSTOM_TYPE } from "../session-ref.js";

// A real end-to-end input/output test of the shipped migration, not the rehearsal.
test("reviewed offline migration opens identical facts with new runtime paths and refuses stale review", async t => {
	const root = fs.mkdtempSync(join(tmpdir(), "noodle-migration-")); fs.chmodSync(root, 0o700);
	const project = join(root, "project"); fs.mkdirSync(project, { mode: 0o700 });
	const fact = "Synthetic observatory has exactly 17 blue chairs.";
	const material = await createArchiveEnvelope("synthetic migration password");
	const stores: Array<{ close(): void }> = [];
	const credentialMap = new Map<string, string>();
	const factory: ArchiveKeychainEntryFactory = (service, account) => ({
		async getPassword() { return credentialMap.get(`${service}/${account}`); },
		async setPassword(value) { credentialMap.set(`${service}/${account}`, value); },
		async deleteCredential() { return credentialMap.delete(`${service}/${account}`); },
	});
	const oldKeys = new NativeArchiveKeychain(factory), nextKeys = new NativeArchiveKeychain(factory, () => "pi-noodle-archive");
	t.after(() => { for (const store of stores) store.close(); material.key.fill(0); credentialMap.clear(); fs.rmSync(root, { recursive: true, force: true }); });
	for (const encrypted of [false, true]) {
		const agent = join(root, encrypted ? "encrypted-agent" : "plain-agent"); fs.mkdirSync(agent, { mode: 0o700 });
		saveNoodleModelSelectionSetting(project, "global", { mode: "follow-main" }, agent);
		const memory = new MemoryStore(agent); stores.push(memory);
		const note = memory.save({ kind: "note", category: "reference", scope: "project", project,
			title: "Observatory fixture", text: fact, source: { lane: "manual", sessionId: "fixture", eventId: "fixture-note" } });
		assert.equal(note.outcome, "saved"); memory.close();
		const entry = { id: "fixture-entry", parentId: null, type: "message", timestamp: "2026-01-02T03:04:05.000Z", message: { role: "assistant", content: fact } };
		const input = { project, sessionId: "fixture", lane: "main" as const, entry };
		const account = "a".repeat(64);
		if (encrypted) {
			const state: VaultReady = { format: "pi-jarvis-archive-vault", version: 1, phase: "ready", revision: randomUUID(),
				active: { id: material.envelope.vaultId, envelope: material.envelope }, retired: [], startup: "remember", remember: { account } };
			new ArchiveVaultFiles(agent).withLock(lock => { lock.write(state); lock.ensureStorageDir(state.active.id); });
			await oldKeys.set(account, material.key);
		}
		const options = encrypted ? { managed: true, storageId: material.envelope.vaultId,
			databaseFactory: (path: string, options: { create: boolean }) => openEncryptedArchiveDatabase(path, material.key, options) } : {};
		const writer = new ArchiveStore(agent, options); stores.push(writer); assert.equal(writer.append(input), "saved"); writer.close();
		const oldArchivePath = writer.path;
		const sidePath = join(agent, "jarvis-sessions", "fixture.jsonl"); fs.mkdirSync(join(agent, "jarvis-sessions"), { mode: 0o700 });
		fs.writeFileSync(sidePath, JSON.stringify(entry) + "\n", { mode: 0o600 });
		const refs = [{ type: "custom", customType: NOODLE_SESSION_REF_CUSTOM_TYPE, data: createNoodleSessionRef(sidePath) }];
		const plan = await previewStorageMigration(agent, "agent");
		assert.ok(plan.targets.includes("extensions/pi-noodle-memory"));
		assert.equal(fs.existsSync(layoutMarker(agent)), false);
		await assert.rejects(applyStorageMigration(agent, "agent", "0".repeat(64)), /reviewed source set changed/);
		assert.equal(fs.existsSync(join(agent, "extensions", "pi-noodle-memory")), false);
		await applyStorageMigration(agent, "agent", plan.review, { old: oldKeys, next: nextKeys });
		assert.equal(migratedLayout(agent), true);
		assert.deepEqual(loadNoodleModelSelectionSetting(project, "global", agent), { mode: "follow-main" });
		const reader = new MemoryStore(agent, () => migratedLayout(agent) ? "noodle" : "legacy"); stores.push(reader);
		assert.equal(reader.get(note.record!.id, project)?.text, fact);
		assert.match(reader.path, /pi-noodle-memory/);
		const archive = new ArchiveStore(agent, { ...options, layout: () => migratedLayout(agent) ? "noodle" : "legacy" }); stores.push(archive);
		const result = archive.session("fixture", project).records;
		assert.equal(result.length, 1);
		assert.equal(archive.read(result[0]!.id, project)?.content, JSON.stringify(entry));
		assert.match(archive.path, /pi-noodle-archive/);
		assert.equal(fs.existsSync(oldArchivePath), true);
		const ref = readNoodleSessionRef(refs, agent);
		assert.equal(ref?.file, join(agent, "noodle-sessions", "fixture.jsonl"));
		assert.equal(fs.readFileSync(ref!.file, "utf8"), fs.readFileSync(sidePath, "utf8"));
		if (encrypted) {
			const key = await nextKeys.get(account); assert.ok(key);
			try { assert.ok(key.equals(material.key)); } finally { key.fill(0); }
			assert.equal(new ArchiveVaultFiles(agent).read()?.phase, "ready");
		}
		await assert.rejects(previewStorageMigration(agent, "agent"), /already uses/);
	}
	saveNoodleModelSelectionSetting(project, "project", { mode: "follow-main" }, join(root, "plain-agent"));
	const projectPlan = await previewStorageMigration(project, "project");
	await applyStorageMigration(project, "project", projectPlan.review);
	assert.deepEqual(loadNoodleModelSelectionSetting(project, "project", join(root, "plain-agent")), { mode: "follow-main" });
	assert.equal(fs.existsSync(join(project, ".pi", "noodle.json")), true);
});
