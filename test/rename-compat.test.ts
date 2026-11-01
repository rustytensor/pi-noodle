import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";

// Gate B: node --import tsx --test test/rename-compat.test.ts
// Main runs the planted ARCHIVE_KEYCHAIN_SERVICE fault first, then restores it.
test("v1.14.0 files and remembered key remain readable; old and new public names work", () => {
	const parent = tmpdir();
	mkdirSync(parent, { recursive: true, mode: 0o700 });
	const root = mkdtempSync(join(parent, "gate-b-"));
	chmodSync(root, 0o700);
	try {
		for (const name of ["home", "agent", "project", "tmp"]) mkdirSync(join(root, name), { mode: 0o700 });
		const child = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("./fixtures/rename-compat/run.ts", import.meta.url)), root], {
			cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", timeout: 90_000,
			// Allowlist, not {...process.env}: never inherit provider keys, real HOME,
			// keyring/session-bus addresses, agent config or NODE_OPTIONS preloads.
			env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: join(root, "home"), NOODLE_COMPAT_FIXTURE_ROOT: root,
				PI_CODING_AGENT_DIR: join(root, "agent"), TMPDIR: join(root, "tmp"),
				XDG_CONFIG_HOME: join(root, "home", ".config"), NO_COLOR: "1" },
		});
		assert.equal(child.error, undefined);
		assert.equal(child.status, 0, child.stderr + child.stdout);
		assert.match(child.stdout, /rename compatibility facts verified/);
	} finally { rmSync(root, { recursive: true, force: true }); }
});
