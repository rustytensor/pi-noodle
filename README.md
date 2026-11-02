pi-noodle: your Pi agent's inner voice and memory.

<div align="center">

<picture>
  <source media="(prefers-reduced-motion: reduce) and (max-width: 760px)" srcset="https://raw.githubusercontent.com/rustytensor/pi-noodle/main/docs/assets/noodle-hero-compact.svg">
  <source media="(prefers-reduced-motion: reduce)" srcset="https://raw.githubusercontent.com/rustytensor/pi-noodle/main/docs/assets/noodle-hero.svg">
  <img src="https://raw.githubusercontent.com/rustytensor/pi-noodle/main/docs/assets/pi-noodle-neon.gif" alt="pi-noodle: a neon skull bowl, noodles becoming a voice, and the Noodle wordmark" width="880">
</picture>

## Remember what matters. Keep your train of thought.

**Shared memory. Optional archive encryption. A side chat beside your main task.**

[Memory](#shared-memory) · [Encryption](#optional-archive-encryption) · [Side chat](#side-chat) · [Install](#quick-start) · [Full guide](docs/user-guide.md)

```bash
pi install npm:pi-noodle
```

<p><strong>Current version:</strong> 1.15.4</p>

[Editable SVG logo](docs/assets/noodle-logo-editable.svg) · [Releases](https://github.com/rustytensor/pi-noodle/releases) · [Issues](https://github.com/rustytensor/pi-noodle/issues)

</div>

**What is it?** pi-noodle is an extension for [Pi, the terminal coding agent](https://github.com/earendil-works/pi). It gives main Pi and its side conversation a shared place to remember useful facts, an optional searchable history archive, and a separate space to ask questions without replacing the main task.

**Know the defaults:** shared memory is **on in trusted projects** and stored in **local plaintext**. Recalled facts can reach your active model. The archive, encryption, watchers and side-chat tool/bridge grants start **off**. Nothing is silently imported or encrypted.

## Shared memory

**Stop explaining the same project decisions in every session.** Save preferences, corrections and useful references once; make them available to both main Pi and Noodle.

<picture>
  <source media="(max-width: 760px)" srcset="https://raw.githubusercontent.com/rustytensor/pi-noodle/main/docs/assets/noodle-memory-flow-compact.svg">
  <img src="https://raw.githubusercontent.com/rustytensor/pi-noodle/main/docs/assets/noodle-memory-flow.svg" alt="Main Pi and the side chat share local memory. You review and edit notes. Relevant facts can return to either conversation; memory is plaintext." width="960">
</picture>

*Conceptual flow, not a live UI. Memory works even when the side-chat window is closed.*

- **Remember useful facts:** project notes for local decisions; global notes for preferences you deliberately want across projects.
- **Find them again:** bounded automatic recall and local keyword search, without embeddings or background model jobs.
- **Stay in control:** inspect provenance, edit curated notes, review deletion, or pause saving and recall separately.
- **Go beyond notes:** the separate, opt-in archive can search recorded conversations and tool output, or explicitly import older Pi sessions.

Try a synthetic project note:

```text
/noodle-memory remember Build workflow | This project uses npm, not pnpm.
/noodle-memory search Build workflow
/noodle-memory editor
```

Memory is **reference material, not higher-priority instructions**. Recall is bounded, not perfect; do not store passwords or tokens in it. [Memory controls and privacy](docs/user-guide.md#shared-memory) · [Editor preview](docs/assets/noodle-memory-editor.svg)

<a id="full-session-archive"></a>

## Optional archive encryption

**Keep a searchable archive, and choose whether to encrypt it on disk.** The archive is separate from shared memory. Recording, model access and encryption are independent opt-ins.

<picture>
  <source media="(max-width: 760px)" srcset="https://raw.githubusercontent.com/rustytensor/pi-noodle/main/docs/assets/noodle-encryption-flow-compact.svg">
  <img src="https://raw.githubusercontent.com/rustytensor/pi-noodle/main/docs/assets/noodle-encryption-flow.svg" alt="Optional encryption protects the active archive database, search index and SQLite journals. Shared memory, original Pi transcripts and retained plaintext copies are outside that boundary. Retrieved text can reach a model." width="960">
</picture>

*Conceptual protection boundary. This is archive encryption, not end-to-end encryption.*

- **Protect the active archive:** its database, search index and SQLite journals—not just individual message bodies.
- **Choose how to unlock:** a password, a session/process grant, a time limit, or an explicitly remembered key in the OS credential store.
- **Search when permitted:** human inspection and model access have separate controls; encrypted storage does not prevent authorized reads from reaching a model provider.

**What it does not encrypt:** shared memory, Pi's original transcripts, attachments, exports and retained plaintext copies. The archive can contain sensitive unredacted content. This is not a sandbox or independently audited cryptography.

<a id="safe-initial-setup"></a>

**Read the [safe setup instructions](docs/user-guide.md#safe-initial-setup) before enabling recording or migrating.** Pause effective capture first if you want to avoid new plaintext archive captures. Password entry requires Pi's regular TUI; native-library and OS requirements apply. Existing plaintext sources remain until you explicitly clean them up.

[Archive search and import](docs/user-guide.md#full-session-archive) · [Encryption, unlock and recovery](docs/user-guide.md#optional-archive-encryption) · [Technical security boundary](docs/archive-encryption-design.md)

<a id="overlay-controls"></a>

## Side chat

**Ask a question without replacing the main conversation.** Open `/noodle` for a separate thread that receives a summary and bounded recent context from main Pi.

<picture>
  <source media="(max-width: 760px)" srcset="https://raw.githubusercontent.com/rustytensor/pi-noodle/main/docs/assets/noodle-side-chat-flow-compact.svg">
  <img src="https://raw.githubusercontent.com/rustytensor/pi-noodle/main/docs/assets/noodle-side-chat-flow.svg" alt="Main Pi supplies bounded context to the side chat. Repo tools, Note main and Redirect start off. Enabled notes and separately reviewed redirects can go back to main. Closing does not stop work." width="960">
</picture>

*Conceptual flow. Separate conversations are not a privacy sandbox; shared memory has its own controls.*

```text
/noodle explain the last validation failure and suggest what to check next
```

Use the main model or choose another physical model with **F2**; adjust thinking with **F3**. Enable repository tools only when wanted. **Note main** sends a quiet follow-up when enabled; **Redirect** requires review for every send.

**Close is not stop.** Assigned work and enabled grants can continue after closing the panel. `/noodle status`, `/noodle stop` and `/noodle access off` keep control available without reopening it. Restart/reload ends background work; this is not a daemon.

[Side-chat controls](docs/user-guide.md#overlay-controls) · [Model selection](docs/user-guide.md#model-and-thinking-resolution) · [Overlay preview](docs/assets/noodle-overlay.svg)

## Quick start

1. Install with `pi install npm:pi-noodle`, then restart or reload Pi.
2. Read the first-use memory notice. Use `/noodle-memory` to inspect effective controls, or `/noodle-memory off` to pause memory without deleting data.
3. Try the memory commands above or open `/noodle`. Enable archive recording, encryption and extra tools only when you choose.

Requires **Pi 1.0.0 or newer** and **Node.js 22.19.0 or newer**. Pi supplies the host runtime and model authentication; this package does not install another copy of Pi. Encryption has optional native dependencies; local runtime validation is Linux-only.

<a id="two-complementary-memory-features"></a>

### What starts on—and what stays off

| Feature | Default | Important boundary |
|---|---|---|
| Shared memory | **On in trusted projects** | Local plaintext; recalled facts may reach your active model. |
| Session archive | **Off** | Separate store; no silent backfill or import. |
| Archive encryption | **Off** | Protects only the active archive; does not turn recording on. |
| Model archive access | **Off** | Separate opt-in; wider searches need approval or an explicit standing setting. |
| Repo tools, Note main, Redirect | **Off** | Separate grants; redirects also need per-send confirmation. |

## Also included

<a id="main-session-watchers"></a>

| Capability | What it adds |
|---|---|
| [Watchers](docs/user-guide.md#main-session-watchers) | Bounded local checks can wake an idle main agent, without model polling. Off by default; the wake-up model turn can cost tokens. |
| [Native MCP](docs/user-guide.md#native-mcp) | Use configured external tools and services through Pi when Repo tools is enabled. |
| [History import](docs/user-guide.md#import-all-existing-pi-sessions) | Preview and explicitly approve existing session files; inspect duplicates and partial results. |
| [Memory editor](docs/user-guide.md#curated-memory-editor) | Browse, search, correct and organize curated notes with visible save/delete reviews. |

## Renamed from pi-jarvis

The old `/jarvis*` commands and `jarvis_*` tools still work as aliases. Saved memory, archives, watchers and side-session references remain compatible. Remove the old extension before loading pi-noodle; do not load both together.

Storage keeps its legacy names unless you explicitly use the [offline storage migration utility](docs/storage-migration.md). No migration is required to use the renamed extension. Historical records and authenticated format tags are not blindly rewritten.

## Go deeper

- [Complete user guide and command reference](docs/user-guide.md)
- [Archive encryption design](docs/archive-encryption-design.md)
- [Editable logo, layers and artwork generation](docs/branding.md)
- [Release process](RELEASING.md) · [Changelog](CHANGELOG.md) · [MIT code license](LICENSE)

Maintained at **[rustytensor/pi-noodle](https://github.com/rustytensor/pi-noodle)**. npm publication is manual.

Logo adapted from 'Death Ramen Skull Bowl Logo' by gagavastard (Envato Elements).
