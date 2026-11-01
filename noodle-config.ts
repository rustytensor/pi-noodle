import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { storageName } from "./storage-layout.js";

export type NoodleModelSelectionScope = "global" | "project";

export type NoodleThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export type StoredNoodleModelSelection =
	| { mode: "follow-main" }
	| { mode: "pinned"; provider: string; modelId: string };

export type StoredNoodleThinkingSelection =
	| { mode: "auto" }
	| { mode: "follow-main" }
	| { mode: "pinned"; thinkingLevel: NoodleThinkingLevel };

type NoodleConfigFile = Record<string, unknown> & {
	modelSelection?: StoredNoodleModelSelection;
	thinkingSelection?: StoredNoodleThinkingSelection;
};

export function getNoodleConfigPath(
	cwd: string,
	scope: NoodleModelSelectionScope,
	agentDir: string = getAgentDir(),
): string {
	return scope === "global" ? join(agentDir, "extensions", storageName(agentDir, "pi-jarvis.json")) : join(cwd, ".pi", storageName(cwd, "jarvis.json", "project")); // Stored identifier from pi-jarvis: never rename (existing users' data and keys).
}

export function loadNoodleModelSelectionSetting(
	cwd: string,
	scope: NoodleModelSelectionScope,
	agentDir: string = getAgentDir(),
): StoredNoodleModelSelection | undefined {
	const path = getNoodleConfigPath(cwd, scope, agentDir);
	const config = readNoodleConfigFileIfPresent(path);
	if (!config) return undefined;
	if (config.modelSelection === undefined) {
		return undefined;
	}

	const selection = parseStoredNoodleModelSelection(config.modelSelection);
	if (!selection) {
		throw new MalformedNoodleConfigError(`Invalid modelSelection in ${path}.`);
	}
	return selection;
}

export function saveNoodleModelSelectionSetting(
	cwd: string,
	scope: NoodleModelSelectionScope,
	selection: StoredNoodleModelSelection,
	agentDir: string = getAgentDir(),
): void {
	const path = getNoodleConfigPath(cwd, scope, agentDir);
	const config = readExistingNoodleConfigFileForWrite(path);
	config.modelSelection = selection;
	writeNoodleConfigFile(path, config);
}

export function clearNoodleModelSelectionSetting(
	cwd: string,
	scope: NoodleModelSelectionScope,
	agentDir: string = getAgentDir(),
): void {
	clearNoodleConfigSetting(cwd, scope, "modelSelection", agentDir);
}

export function loadNoodleThinkingSelectionSetting(
	cwd: string,
	scope: NoodleModelSelectionScope,
	agentDir: string = getAgentDir(),
): StoredNoodleThinkingSelection | undefined {
	const path = getNoodleConfigPath(cwd, scope, agentDir);
	const config = readNoodleConfigFileIfPresent(path);
	if (!config) return undefined;
	if (config.thinkingSelection === undefined) {
		return undefined;
	}

	const selection = parseStoredNoodleThinkingSelection(config.thinkingSelection);
	if (!selection) {
		throw new MalformedNoodleConfigError(`Invalid thinkingSelection in ${path}.`);
	}
	return selection;
}

export function saveNoodleThinkingSelectionSetting(
	cwd: string,
	scope: NoodleModelSelectionScope,
	selection: StoredNoodleThinkingSelection,
	agentDir: string = getAgentDir(),
): void {
	const path = getNoodleConfigPath(cwd, scope, agentDir);
	const config = readExistingNoodleConfigFileForWrite(path);
	config.thinkingSelection = selection;
	writeNoodleConfigFile(path, config);
}

export function clearNoodleThinkingSelectionSetting(
	cwd: string,
	scope: NoodleModelSelectionScope,
	agentDir: string = getAgentDir(),
): void {
	clearNoodleConfigSetting(cwd, scope, "thinkingSelection", agentDir);
}

function clearNoodleConfigSetting(
	cwd: string,
	scope: NoodleModelSelectionScope,
	setting: "modelSelection" | "thinkingSelection",
	agentDir: string,
): void {
	const path = getNoodleConfigPath(cwd, scope, agentDir);
	const config = readNoodleConfigFileIfPresent(path);
	if (!config) return;

	delete config[setting];
	if (Object.keys(config).length === 0) {
		rmSync(path, { force: true });
		return;
	}

	writeNoodleConfigFile(path, config);
}

export class MalformedNoodleConfigError extends Error {}

function readNoodleConfigFileIfPresent(path: string): NoodleConfigFile | undefined {
	try {
		return readNoodleConfigFile(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
		throw error;
	}
}

function readNoodleConfigFile(path: string): NoodleConfigFile {
	// Keep I/O errors distinct from malformed content; neither permits overwriting existing settings.
	const text = readFileSync(path, "utf-8");
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch (error) {
		// Parser messages can contain private input snippets; expose only safe repair guidance.
		throw new MalformedNoodleConfigError(
			`Invalid JSON in ${path}. Repair this file manually before changing settings to preserve memory/privacy settings.`,
			{ cause: error },
		);
	}

	if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
		throw new MalformedNoodleConfigError(
			`Expected ${path} to contain a JSON object. Repair this file manually before changing settings to preserve memory/privacy settings.`,
		);
	}

	return { ...(raw as Record<string, unknown>) };
}

function readExistingNoodleConfigFileForWrite(path: string): NoodleConfigFile {
	// Shared files can contain memory kill switches and unknown settings. Never recover by discarding them.
	return readNoodleConfigFileIfPresent(path) ?? {};
}

function writeNoodleConfigFile(path: string, config: NoodleConfigFile): void {
	mkdirSync(dirname(path), { recursive: true });
	let mode = 0o600;
	try {
		mode = statSync(path).mode & 0o777;
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") throw error;
	}
	const temporaryPath = `${path}.${randomUUID()}.tmp`;
	let fd: number | undefined;
	let created = false;
	try {
		fd = openSync(temporaryPath, "wx", mode);
		created = true;
		writeFileSync(fd, `${JSON.stringify(config, null, "\t")}\n`, "utf-8");
		fsyncSync(fd);
		closeSync(fd);
		fd = undefined;
		// Same-directory rename means readers see either the old or complete new file.
		renameSync(temporaryPath, path);
		created = false;
	} finally {
		// Cleanup is best effort after a failed operation; never mask its error.
		if (fd !== undefined) {
			try { closeSync(fd); } catch { /* Keep the original write/close failure. */ }
		}
		if (created) {
			try { rmSync(temporaryPath, { force: true }); } catch { /* Keep the original failure. */ }
		}
	}
}

function parseStoredNoodleModelSelection(data: unknown): StoredNoodleModelSelection | undefined {
	if (!data || typeof data !== "object") {
		return undefined;
	}

	const candidate = data as { mode?: unknown; provider?: unknown; modelId?: unknown };
	if (candidate.mode === "follow-main") {
		return { mode: "follow-main" };
	}
	if (
		candidate.mode === "pinned" &&
		typeof candidate.provider === "string" &&
		candidate.provider.length > 0 &&
		typeof candidate.modelId === "string" &&
		candidate.modelId.length > 0
	) {
		return {
			mode: "pinned",
			provider: candidate.provider,
			modelId: candidate.modelId,
		};
	}
	return undefined;
}

function parseStoredNoodleThinkingSelection(data: unknown): StoredNoodleThinkingSelection | undefined {
	if (!data || typeof data !== "object") {
		return undefined;
	}

	const candidate = data as { mode?: unknown; thinkingLevel?: unknown };
	if (candidate.mode === "auto") {
		return { mode: "auto" };
	}
	if (candidate.mode === "follow-main") {
		return { mode: "follow-main" };
	}
	if (candidate.mode === "pinned" && isNoodleThinkingLevel(candidate.thinkingLevel)) {
		return { mode: "pinned", thinkingLevel: candidate.thinkingLevel };
	}
	return undefined;
}

function isNoodleThinkingLevel(value: unknown): value is NoodleThinkingLevel {
	return value === "off" || value === "minimal" || value === "low" || value === "medium" || value === "high" || value === "xhigh" || value === "max";
}
