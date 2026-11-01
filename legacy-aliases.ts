import type { ExtensionAPI, ToolDefinition } from "@earendil-works/pi-coding-agent";

/** Compatibility names only: old prompts and transcripts may still call these. */
export const LEGACY_COMMANDS: Readonly<Record<string, string>> = Object.freeze({
	jarvis: "noodle", "jarvis-model": "noodle-model", "jarvis-thinking": "noodle-thinking",
	"jarvis-memory": "noodle-memory", "jarvis-archive": "noodle-archive", "jarvis-watchers": "noodle-watchers",
});
export const LEGACY_TOOLS: Readonly<Record<string, string>> = Object.freeze({
	jarvis_memory_search: "noodle_memory_search", jarvis_memory_remember: "noodle_memory_remember", jarvis_memory_forget: "noodle_memory_forget",
	jarvis_archive_search: "noodle_archive_search", jarvis_archive_read: "noodle_archive_read", jarvis_archive_session: "noodle_archive_session",
	jarvis_watcher_set: "noodle_watcher_set", jarvis_watcher_list: "noodle_watcher_list", jarvis_watcher_cancel: "noodle_watcher_cancel",
	jarvis_send_follow_up_to_main: "noodle_send_follow_up_to_main", jarvis_send_steer_to_main: "noodle_send_steer_to_main",
});
export function stripLegacyMemoryPrompt(prompt: string): string {
	return prompt.replace(/\s*<(noodle|jarvis)_memory_policy>[\s\S]*?<\/\1_memory_policy>\s*/g, "\n");
}
export function clearMemoryPolicySections(sections: Record<string, unknown>): void {
	delete sections.noodle_memory_policy; delete sections.jarvis_memory_policy;
}
export const LEGACY_COMMAND_NOTICE = "/jarvis is now /noodle";
/** Stored provenance is not branding and remains unchanged on disk. */
export function laneLabel(lane: string): string { return lane === "jarvis" ? "noodle" : lane; }
export function canonicalToolName(name: string): string { return LEGACY_TOOLS[name] ?? name; }
export function canonicalCommand(text: string): string {
	return text.replace(/^\/(jarvis(?:-model|-thinking|-memory|-archive|-watchers)?)(?=\s|$)/, (_all, name: string) => `/${LEGACY_COMMANDS[name]}`);
}
export function animationDisabled(env: NodeJS.ProcessEnv): boolean {
	return env.PI_NOODLE_NO_ANIMATION === "1" || env.PI_JARVIS_NO_ANIMATION === "1";
}

/**
 * Do not use exposure:hidden for live aliases: Pi makes those unreachable.
 * Active aliases instead hide their declarations through the public loadout API.
 * They share the canonical execute closure, permission epoch and cancellation guards.
 * Re-registration on revocation applies the same hidden exposure to BOTH names.
 */
const wrappedApis = new WeakSet<ExtensionAPI>();
export function withLegacyAliases(api: ExtensionAPI): ExtensionAPI {
	if (wrappedApis.has(api)) return api;
	const owned = new Map<string, string>();
	const availableAliases = () => {
		const registered = typeof api.getAllTools === "function" ? new Set(api.getAllTools().map(tool => tool.name)) : new Set(owned.keys());
		return Object.entries(LEGACY_TOOLS).filter(([legacy]) => registered.has(legacy));
	};
	const wrapped = new Proxy(api, {
		get(target, property, receiver) {
			if (property === "getActiveTools") return () => target.getActiveTools().filter(name => !(name in LEGACY_TOOLS));
			if (property === "setActiveTools") return (names: string[]) => {
				const canonical = names.filter(name => !(name in LEGACY_TOOLS));
				target.setActiveTools([...canonical, ...availableAliases().filter(([, name]) => canonical.includes(name)).map(([name]) => name)]);
			};
			if (property === "registerCommand") return (name: string, command: Parameters<ExtensionAPI["registerCommand"]>[1]) => {
				target.registerCommand(name, command);
				for (const [legacy, canonical] of Object.entries(LEGACY_COMMANDS)) if (canonical === name) {
					target.registerCommand(legacy, { ...command, description: `Compatibility alias for /${name}`,
						handler: (args, ctx) => { ctx.ui.notify(LEGACY_COMMAND_NOTICE, "info"); return command.handler(args, ctx); } });
				}
			};
			if (property === "registerTool") return (tool: ToolDefinition) => {
				target.registerTool(tool);
				for (const [legacy, canonical] of Object.entries(LEGACY_TOOLS)) if (canonical === tool.name) {
					owned.set(legacy, canonical);
					target.registerTool({ ...tool, name: legacy, prepareLoadout(loadout) {
						const changes = tool.prepareLoadout?.(loadout);
						return { ...changes, hiddenDeclarations: [...(changes?.hiddenDeclarations ?? []), legacy] };
					} });
				}
			};
			if (property === "on") return (event: string, handler: (...args: any[]) => any) => {
				// Wrap the existing handler, never insert an earlier lifecycle handler.
				const wrapped = event === "tool_call" ? (value: any, ctx: any) => handler({ ...value, toolName: canonicalToolName(value.toolName) }, ctx)
					: event === "before_agent_start" ? (value: any, ctx: any) => {
						const sync = (result: any) => {
							const selected = value.systemPromptOptions?.selectedTools;
							if (Array.isArray(selected)) {
								const canonical = selected.filter((name: string) => !(name in LEGACY_TOOLS));
								value.systemPromptOptions.selectedTools = [...canonical, ...availableAliases().filter(([, name]) => canonical.includes(name)).map(([name]) => name)];
							}
							return result;
						};
						const result = handler(value, ctx);
						return result && typeof result.then === "function" ? result.then(sync) : sync(result);
					} : handler;
				return (target.on as any)(event, wrapped);
			};
			return Reflect.get(target, property, receiver);
		},
	});
	wrappedApis.add(wrapped);
	return wrapped;
}
