import { constants, closeSync, fstatSync, openSync, readFileSync, statSync, lstatSync } from "node:fs";
import { join, relative, isAbsolute } from "node:path";

export const LAYOUT_MARKER = "pi-noodle-layout.json";
export type StorageScope = "agent" | "project";
export const MIGRATED_LAYOUT = '{"version":1,"layout":"noodle"}\n';
export function layoutMarker(root: string, scope: StorageScope = "agent"): string {
	return join(root, scope === "agent" ? "extensions" : ".pi", LAYOUT_MARKER);
}
/** Explicit migration only. Missing marker means legacy paths, including fresh installs. */
export function migratedLayout(root: string, scope: StorageScope = "agent"): boolean {
	// Metadata-only missing-marker fast path; permission errors never select legacy storage.
	try { statSync(root); }
	catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw new Error("Storage root cannot be inspected safely."); }
	try { lstatSync(layoutMarker(root, scope)); }
	catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw new Error("Storage layout cannot be inspected safely."); }
	let fd: number;
	try { fd = openSync(layoutMarker(root, scope), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
	catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw new Error("Storage layout is unreadable; no fallback was used."); }
	try {
		const info = fstatSync(fd);
		if (!info.isFile() || info.nlink !== 1 || info.size !== Buffer.byteLength(MIGRATED_LAYOUT) ||
			(info.mode & 0o022) !== 0 || (typeof process.getuid === "function" && info.uid !== process.getuid()) ||
			readFileSync(fd, "utf8") !== MIGRATED_LAYOUT) throw new Error("Invalid storage layout; manual inspection required.");
		return true;
	} finally { closeSync(fd); }
}
export function selectedStorageLayout(root: string): "legacy" | "noodle" { return migratedLayout(root) ? "noodle" : "legacy"; }
export function storageName(root: string, legacy: string, scope: StorageScope = "agent"): string {
	return migratedLayout(root, scope) ? legacy.replace("jarvis", "noodle") : legacy;
}
/** Retain historical transcript references; translate only paths inside the known old side directory. */
export function migratedSideReference(agentDir: string, file: string): string {
	// Stored identifier from pi-jarvis: never rename (existing users' data and keys).
	const old = join(agentDir, "jarvis-sessions");
	const suffix = relative(old, file);
	if (isAbsolute(suffix) || suffix === ".." || suffix.startsWith("../") || suffix.startsWith("..\\")) return file;
	return migratedLayout(agentDir) ? join(agentDir, "noodle-sessions", suffix) : file;
}
