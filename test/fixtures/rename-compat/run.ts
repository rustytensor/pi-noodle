import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MemoryStore as OldMemoryStore } from "./v1.14.0/memory-store.js";
import { ArchiveStore as OldArchiveStore } from "./v1.14.0/archive-store.js";
import { saveJarvisModelSelectionSetting, saveJarvisThinkingSelectionSetting } from "./v1.14.0/jarvis-config.js";
import { saveMemoryPolicy, markMemoryDisclosure } from "./v1.14.0/memory-config.js";
import { saveArchivePolicy } from "./v1.14.0/archive-config.js";
import { createArchiveEnvelope } from "./v1.14.0/archive-crypto.js";
import { ArchiveVaultFiles } from "./v1.14.0/archive-vault-files.js";
import { openEncryptedArchiveDatabase } from "./v1.14.0/archive-sqlite.js";
import { NativeArchiveKeychain as OldKeychain } from "./v1.14.0/archive-keychain.js";
import { NativeArchiveKeychain, type ArchiveKeychainEntryFactory } from "../../../archive-keychain.js";
import { ArchiveStore } from "../../../archive-store.js";
import { ArchiveVault } from "../../../archive-vault.js";
import { loadNoodleModelSelectionSetting, loadNoodleThinkingSelectionSetting } from "../../../noodle-config.js";
import { resolveMemoryPolicy } from "../../../memory-config.js";
import { resolveArchivePolicy } from "../../../archive-config.js";
import { SharedMemoryService } from "../../../memory-service.js";
import { createMemoryExtensionFactory, stripMemoryPrompt } from "../../../memory-extension.js";
import extension from "../../../index.js";

assert.equal(stripMemoryPrompt("BASE\n<jarvis_memory_policy>obsolete</jarvis_memory_policy>\nTAIL"), "BASE\nTAIL");
const root = process.argv[2]!;
assert.equal(root, process.env.NOODLE_COMPAT_FIXTURE_ROOT);
const agent = join(root, "agent"), project = join(root, "project"), encryptedAgent = join(root, "encrypted-agent");
mkdirSync(encryptedAgent, { mode: 0o700 });
const sessionId = "synthetic-rename-session";
const fact = "The synthetic observatory uses violet ceramic lenses.";
const title = "Synthetic observatory lens material";
const model = { mode: "pinned" as const, provider: "fixture-provider", modelId: "fixture-model" };
const thinking = { mode: "pinned" as const, thinkingLevel: "low" as const };
const notices: string[] = [];
const noProvider = () => { throw new Error("Gate B must never boot a provider or execute a host tool"); };
const ctx: any = {
	cwd: project, mode: "rpc", hasUI: true, isProjectTrusted: () => true,
	sessionManager: { getSessionId: () => sessionId, getLeafId: () => null, getBranch: () => [], getEntries: () => [] },
	ui: { notify: (text: string) => notices.push(text), setStatus: () => {}, confirm: async () => false },
	modelRegistry: { getAvailable: () => [], find: noProvider, getApiKey: noProvider }, executeTool: noProvider,
};

// These are the archived writers, never current code disguised as old code.
for (const scope of ["global", "project"] as const) {
	saveJarvisModelSelectionSetting(project, scope, model, agent);
	saveJarvisThinkingSelectionSetting(project, scope, thinking, agent);
}
saveMemoryPolicy(project, agent, "global", { enabled: true, capture: false, recall: true });
markMemoryDisclosure(agent);
saveArchivePolicy(project, agent, "global", { enabled: true, capture: false, modelAccess: true });
const oldMemory = new OldMemoryStore(agent);
try {
	assert.equal(oldMemory.save({ kind: "note", category: "reference", scope: "project", project, title, text: fact,
		source: { lane: "jarvis", sessionId, eventId: "synthetic-old-note" } }).outcome, "saved");
} finally { oldMemory.close(); }
const entry = { id: "synthetic-old-entry", type: "message", parentId: null, timestamp: "2026-01-02T03:04:05.000Z",
	message: { role: "assistant", content: [{ type: "text", text: "Synthetic archive: seven violet lenses. 🟣" }] } };
const input = { project, sessionId, lane: "jarvis" as const, entry };
const oldPlain = new OldArchiveStore(agent);
try { assert.equal(oldPlain.append(input), "saved"); } finally { oldPlain.close(); }

// No real native keychain is loaded. Both historical/current adapters receive
// this fake entry factory; service is part of the address, not ignored.
const credentials = new Map<string, string>();
const calls: string[] = [];
const fakeEntries: ArchiveKeychainEntryFactory = (service, account, options) => {
	assert.deepEqual(options, { linux: { store: "secret-service" } });
	calls.push(service);
	const address = `${service}/${account}`;
	return { getPassword: async () => credentials.get(address),
		setPassword: async value => { credentials.set(address, value); },
		deleteCredential: async () => credentials.delete(address) };
};
const created = await createArchiveEnvelope("Synthetic test password, never a user credential");
const revision = randomUUID(), account = createHash("sha256").update(JSON.stringify([
	encryptedAgent, created.envelope.vaultId, revision,
])).digest("hex");
const files = new ArchiveVaultFiles(encryptedAgent);
files.withLock(locked => {
	locked.write({ format: "pi-jarvis-archive-vault", version: 1, phase: "ready", revision,
		active: { id: created.envelope.vaultId, envelope: created.envelope }, startup: "remember", remember: { account }, retired: [] });
	locked.ensureStorageDir(created.envelope.vaultId);
	const writer = new OldArchiveStore(encryptedAgent, { managed: true, storageId: created.envelope.vaultId,
		databaseFactory: (path, options) => openEncryptedArchiveDatabase(path, created.key, options) });
	try { assert.equal(writer.append(input), "saved"); } finally { writer.close(); }
});
// Freeze the old address literally. Even if BOTH adapters were accidentally
// renamed, seeding cannot follow the current service constant.
await new OldKeychain((_service, name, options) => fakeEntries("pi-jarvis-archive", name, options)).set(account, created.key);
created.key.fill(0);
const keychain = new NativeArchiveKeychain(fakeEntries);
const legacy = new ArchiveStore(encryptedAgent);
const vault = new ArchiveVault(encryptedAgent, legacy, { isAllowed: () => true, onChange: () => {}, keychain,
	prompt: async () => { throw new Error("Remembered unlock must not prompt"); } });
try {
	await vault.start(ctx);
	assert.equal(vault.available(ctx), true, "v1.14.0 remembered key must unlock under the literal old keychain service");
	assert.ok(calls.length >= 2);
	assert.ok(calls.every(service => service === "pi-jarvis-archive"), "keychain namespace changed");
	vault.execute(ctx, store => {
		const rows = store.session(sessionId, project).records;
		assert.equal(rows.length, 1);
		assert.equal(store.read(rows[0]!.id, project)!.content, JSON.stringify(entry));
		assert.equal(store.search({ project, query: "violet" }).records.length, 1);
	});
} finally { vault.shutdown("quit"); legacy.close(); credentials.clear(); }

for (const scope of ["global", "project"] as const) {
	assert.deepEqual(loadNoodleModelSelectionSetting(project, scope, agent), model);
	assert.deepEqual(loadNoodleThinkingSelectionSetting(project, scope, agent), thinking);
}
assert.equal(resolveMemoryPolicy(project, agent).policy.capture, false);
assert.equal(resolveMemoryPolicy(project, agent).policy.recall, true);
assert.equal(resolveArchivePolicy(project, agent).policy.enabled, true);
assert.equal(resolveArchivePolicy(project, agent).policy.capture, false);
for (const path of [join(agent, "extensions", "pi-jarvis.json"), join(project, ".pi", "jarvis.json"),
	join(agent, "extensions", "pi-jarvis-memory", "memory.sqlite"), join(agent, "extensions", "pi-jarvis-archive", "archive.sqlite")]) assert.ok(existsSync(path), path);
const plain = new ArchiveStore(agent);
try {
	const rows = plain.session(sessionId, project).records;
	assert.equal(rows.length, 1);
	assert.equal(plain.read(rows[0]!.id, project)!.content, JSON.stringify(entry));
} finally { plain.close(); }

function harness() {
	const handlers = new Map<string, Function[]>(), tools = new Map<string, any>(), commands = new Map<string, any>();
	const api: any = { registerTool: (tool: any) => tools.set(tool.name, tool),
		registerCommand: (name: string, command: any) => commands.set(name, command),
		on: (name: string, handler: Function) => handlers.set(name, [...(handlers.get(name) ?? []), handler]),
		getThinkingLevel: () => "off", exec: noProvider, sendUserMessage: noProvider, appendEntry: noProvider };
	return { api, tools, commands, async emit(name: string) { for (const handler of handlers.get(name) ?? []) await handler({ type: name }, ctx); } };
}
const memory = new SharedMemoryService(agent), mount = harness();
try {
	createMemoryExtensionFactory(memory, "main")(mount.api);
	await mount.emit("session_start");
	for (const name of ["jarvis_memory_search", "noodle_memory_search"]) {
		const tool = mount.tools.get(name);
		assert.ok(tool, name);
		const result = await tool.execute("synthetic-search", { query: "violet", scope: "current" }, undefined, undefined, ctx);
		const text = result.content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("\n");
		const records = JSON.parse(text).records;
		assert.equal(records.length, 1);
		assert.equal(records[0].title, title);
		assert.equal(records[0].text, fact);
		assert.equal(records[0].source.lane, "jarvis");
	}
	const alias = mount.tools.get("jarvis_memory_search");
	assert.ok(alias.prepareLoadout({}).hiddenDeclarations.includes("jarvis_memory_search"));
} finally { await mount.emit("session_shutdown"); memory.close(); }

// Exercise the actual extension's registered command handlers without a model,
// TUI, resource discovery, real settings directory or session-start boot.
const main = harness();
extension(main.api);
for (const name of ["jarvis", "noodle"]) {
	assert.ok(main.commands.has(name));
	notices.length = 0;
	await main.commands.get(name).handler("", ctx);
	assert.ok(notices.includes("/noodle requires Pi's interactive terminal UI."));
	if (name === "jarvis") assert.ok(notices.includes("/jarvis is now /noodle"));
}
assert.equal(JSON.parse(readFileSync(join(project, ".pi", "jarvis.json"), "utf8")).modelSelection.modelId, "fixture-model");
console.log("rename compatibility facts verified");
