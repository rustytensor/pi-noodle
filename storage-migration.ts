#!/usr/bin/env node
/** Offline opt-in relocation. Never imported by the extension's startup path. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import { dirname, join, resolve, relative, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import { NativeArchiveKeychain } from "./archive-keychain.js";
import { openEncryptedArchiveDatabase } from "./archive-sqlite.js";
import { parseArchiveEnvelope } from "./archive-crypto.js";
import { LAYOUT_MARKER, MIGRATED_LAYOUT, layoutMarker, migratedLayout, type StorageScope } from "./storage-layout.js";

const PENDING = "pi-noodle-migration.pending.json";
// Stored identifier from pi-jarvis: never rename (existing users' data and keys).
const AGENT_NAMES = ["extensions/pi-jarvis.json", "extensions/pi-jarvis-archive.json", "extensions/pi-jarvis-watchers.json", "extensions/pi-jarvis-memory", "extensions/pi-jarvis-archive", "jarvis-sessions"];
// Stored identifier from pi-jarvis: never rename (existing users' data and keys).
const PROJECT_NAMES = [".pi/jarvis.json", ".pi/jarvis-archive.json", ".pi/jarvis-watchers.json"];
interface FileCopy { from: string; to: string; size: number; sha256: string; dev: number; ino: number; mtimeMs: number; ctimeMs: number }
export interface StorageMigrationPreview { version: 1; root: string; scope: StorageScope; files: FileCopy[]; directories: string[]; targets: string[]; bytes: number; review: string }
export interface MigrationCredentials {
	old: Pick<NativeArchiveKeychain, "get">;
	next: Pick<NativeArchiveKeychain, "get" | "set">;
}
function fail(message: string): never { throw new Error(message); }
function privateOwner(info: fs.Stats): void {
	if ((info.mode & 0o022) || (typeof process.getuid === "function" && info.uid !== process.getuid())) fail("Unsafe storage owner or permissions.");
}
function exists(path: string): boolean {
	try { fs.lstatSync(path); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}
function safePath(root: string, path: string): void {
	const suffix = relative(root, path);
	if (isAbsolute(suffix) || suffix === ".." || suffix.startsWith("../") || suffix.startsWith("..\\")) fail("Migration path escaped selected root.");
	let current = root;
	for (const part of ["", ...suffix.split(/[\\/]/).filter(Boolean)]) {
		if (part) current = join(current, part);
		if (!exists(current)) break;
		const info = fs.lstatSync(current); privateOwner(info);
		if (info.isSymbolicLink()) fail("Migration refuses symbolic links.");
	}
}
async function hashFile(path: string): Promise<string> {
	const hash = createHash("sha256");
	const stream = fs.createReadStream(path, { fd: fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW), autoClose: true });
	for await (const bytes of stream) hash.update(bytes);
	return hash.digest("hex");
}
function pendingPath(root: string, scope: StorageScope): string { return join(dirname(layoutMarker(root, scope)), PENDING); }
function syncFile(path: string): void { const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
function writeExclusive(path: string, text: string): void { fs.writeFileSync(path, text, { flag: "wx", mode: 0o600 }); syncFile(path); syncFile(dirname(path)); }

/** Requires stopped Pi instances: hashing is not a snapshot of a live database. */
export async function previewStorageMigration(rootInput: string, scope: StorageScope): Promise<StorageMigrationPreview> {
	if (!isAbsolute(rootInput) || !["agent", "project"].includes(scope)) fail("Choose an absolute root and agent or project scope.");
	const root = fs.realpathSync(rootInput); safePath(root, root);
	if (exists(pendingPath(root, scope))) fail("An unfinished migration needs manual inspection; no automatic replay.");
	if (migratedLayout(root, scope)) fail("This root already uses the new layout.");
	const files: FileCopy[] = [], directories: string[] = [], targets: string[] = [];
	let visited = 0, bytes = 0;
	async function visit(from: string, to: string, depth: number): Promise<void> {
		if (++visited > 50_000 || depth > 64) fail("Migration inventory limit exceeded.");
		const source = join(root, from); safePath(root, source);
		const info = fs.lstatSync(source); privateOwner(info);
		if (info.isDirectory()) {
			directories.push(to);
			for (const name of fs.readdirSync(source).sort()) await visit(join(from, name), join(to, name), depth + 1);
		} else {
			if (!info.isFile() || info.nlink !== 1 || /(?:\.lock|\.lock\..*)$/.test(from)) fail("Migration refuses links, special files and outstanding locks.");
			const sha256 = await hashFile(source), after = fs.lstatSync(source);
			if (info.dev !== after.dev || info.ino !== after.ino || info.size !== after.size || info.mtimeMs !== after.mtimeMs || info.ctimeMs !== after.ctimeMs) fail("Source changed while previewing; nothing copied.");
			files.push({ from, to, size: info.size, sha256, dev: info.dev, ino: info.ino, mtimeMs: info.mtimeMs, ctimeMs: info.ctimeMs }); bytes += info.size;
		}
	}
	for (const from of scope === "agent" ? AGENT_NAMES : PROJECT_NAMES) {
		const to = from.replace("jarvis", "noodle");
		if (exists(join(root, to))) fail("A new-name destination already exists; no merge or overwrite.");
		if (exists(join(root, from))) { targets.push(to); await visit(from, to, 0); }
	}
	if (!files.length) fail("No old storage files found in the selected root.");
	const body = { version: 1 as const, root, scope, files, directories, targets, bytes };
	return { ...body, review: createHash("sha256").update(JSON.stringify(body)).digest("hex") };
}

/** Copy, verify, then publish one marker. Originals and old credentials are retained. */
export async function applyStorageMigration(root: string, scope: StorageScope, review: string, credentials?: MigrationCredentials): Promise<StorageMigrationPreview> {
	const plan = await previewStorageMigration(root, scope);
	if (!/^[a-f0-9]{64}$/.test(review) || plan.review !== review) fail("The reviewed source set changed; preview again. Nothing copied.");
	const available = fs.statfsSync(plan.root); if (available.bavail * available.bsize < plan.bytes + 16 * 1024 * 1024) fail("Insufficient space for a retained original and migration copy.");
	const marker = layoutMarker(plan.root, scope), pending = pendingPath(plan.root, scope);
	fs.mkdirSync(dirname(marker), { recursive: true, mode: 0o700 }); safePath(plan.root, dirname(marker));
	writeExclusive(pending, JSON.stringify(plan));
	let key: Buffer | undefined;
	try {
		for (const dir of plan.directories) { safePath(plan.root, dirname(join(plan.root, dir))); fs.mkdirSync(join(plan.root, dir), { mode: 0o700 }); }
		for (const file of plan.files) {
			const from = join(plan.root, file.from), to = join(plan.root, file.to);
			safePath(plan.root, from); safePath(plan.root, dirname(to));
			const before = fs.lstatSync(from);
			if (before.dev !== file.dev || before.ino !== file.ino || before.size !== file.size || before.mtimeMs !== file.mtimeMs || before.ctimeMs !== file.ctimeMs) fail("Reviewed source changed; partial copy retained, old layout still active.");
			fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL); fs.chmodSync(to, 0o600); syncFile(to);
			if (await hashFile(to) !== file.sha256 || await hashFile(from) !== file.sha256) fail("Copy verification failed; old layout still active.");
		}
		// Only a remembered key can authenticate encrypted storage in this offline utility.
		// No password argument, environment variable or ordinary terminal password input.
		const vaultPath = join(plan.root, "extensions", "pi-noodle-archive", "archive.vault.json");
		if (scope === "agent" && exists(vaultPath)) {
			const info = fs.lstatSync(vaultPath); if (info.size > 65536) fail("Vault metadata exceeds bounds.");
			const state = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
			// Stored identifier from pi-jarvis: never rename (existing users' data and keys).
			if (state.format !== "pi-jarvis-archive-vault" || state.version !== 1 || state.phase !== "ready") fail("Only ready vaults can be relocated.");
			if (state.active?.envelope) {
				const envelope = parseArchiveEnvelope(state.active.envelope);
				if (state.active.id !== envelope.vaultId || state.startup !== "remember" || !/^[a-f0-9]{64}$/.test(state.remember?.account ?? "")) fail("Encrypted relocation needs an existing remembered unlock. Originals retained; do not retry without inspecting partial copies.");
				const stores = credentials ?? { old: new NativeArchiveKeychain(), next: new NativeArchiveKeychain(undefined, () => "pi-noodle-archive") };
				key = await stores.old.get(state.remember.account); if (!key) fail("The old remembered key is unavailable.");
				const db = openEncryptedArchiveDatabase(join(dirname(vaultPath), "vaults", envelope.vaultId, "archive.sqlite"), key);
				try { if (Object.values(db.prepare("PRAGMA integrity_check").get() ?? {})[0] !== "ok") fail("Encrypted archive integrity check failed."); } finally { db.close(); }
				const existing = await stores.next.get(state.remember.account);
				if (existing) { existing.fill(0); fail("A new-service credential already exists; it was not overwritten."); }
				await stores.next.set(state.remember.account, key);
				const copied = await stores.next.get(state.remember.account);
				try { if (!copied || !copied.equals(key)) fail("Remembered-key copy verification failed."); } finally { copied?.fill(0); }
			}
		}
		// Recheck every original before activation. Retained originals are the rollback copies.
		for (const file of plan.files) { safePath(plan.root, join(plan.root, file.from)); if (await hashFile(join(plan.root, file.from)) !== file.sha256) fail("Source changed before activation."); }
		for (const dir of plan.directories.slice().reverse()) syncFile(join(plan.root, dir));
		writeExclusive(marker, MIGRATED_LAYOUT);
		fs.unlinkSync(pending); syncFile(dirname(marker));
		return plan;
	} catch (error) {
		// Publication may already have succeeded. Never infer a rollback or replay writes.
		throw new Error(`Migration stopped; inspect ${JSON.stringify(pending)} and ${JSON.stringify(marker)} before restarting Pi. Original files were retained. ${error instanceof Error ? error.message : "Operation failed."}`);
	} finally { key?.fill(0); }
}

async function cli(): Promise<void> {
	const [action, root, scope, ...flags] = process.argv.slice(2);
	if (!["preview", "apply"].includes(action ?? "") || !root || !["agent", "project"].includes(scope ?? "") || !flags.includes("--confirm-stopped") ||
		(action === "apply" && !flags.includes("--confirm-sensitive"))) fail("Usage: pi-noodle-migrate preview ROOT agent|project --confirm-stopped; apply ROOT agent|project --confirm-stopped --confirm-sensitive --review HASH. Stop ALL Pi instances first. No originals are deleted.");
	const reviewAt = flags.indexOf("--review"), review = flags[reviewAt + 1];
	const plan = action === "preview" ? await previewStorageMigration(root, scope as StorageScope) : await applyStorageMigration(root, scope as StorageScope, reviewAt < 0 ? "" : review ?? "");
	console.log(JSON.stringify({ action, root: plan.root, scope: plan.scope, files: plan.files.length, bytes: plan.bytes, targets: plan.targets, review: plan.review, originalsRetained: true }, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	cli().catch(error => { console.error(error instanceof Error ? error.message : "Migration failed."); process.exitCode = 1; });
}
