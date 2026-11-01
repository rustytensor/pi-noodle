import { migratedSideReference } from "./storage-layout.js";

export const NOODLE_SESSION_REF_CUSTOM_TYPE = "jarvis.session-ref"; // Stored identifier from pi-jarvis: never rename (existing users' data and keys).

export interface NoodleSessionRef {
	version: 1;
	file: string;
}

type BranchEntryLike = {
	type: string;
	customType?: string;
	data?: unknown;
};

export function readNoodleSessionRef(entries: readonly BranchEntryLike[], agentDir?: string): NoodleSessionRef | undefined {
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		if (entry.type !== "custom" || entry.customType !== NOODLE_SESSION_REF_CUSTOM_TYPE) {
			continue;
		}
		const ref = parseNoodleSessionRef(entry.data);
		return ref && agentDir ? { ...ref, file: migratedSideReference(agentDir, ref.file) } : ref;
	}
	return undefined;
}


export function createNoodleSessionRef(file: string): NoodleSessionRef {
	return {
		version: 1,
		file,
	};
}


function parseNoodleSessionRef(data: unknown): NoodleSessionRef | undefined {
	if (!data || typeof data !== "object") {
		return undefined;
	}

	const candidate = data as { version?: unknown; file?: unknown };
	if (candidate.version !== 1 || typeof candidate.file !== "string" || candidate.file.length === 0) {
		return undefined;
	}

	return {
		version: 1,
		file: candidate.file,
	};
}
