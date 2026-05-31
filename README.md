# AGENTS.md Bridge

Make **Claude Code read `AGENTS.md`** — without committing a Claude-specific file to your repo.

[`AGENTS.md`](https://agents.md/) is the vendor-neutral standard for agent instructions, read natively by Codex, Cursor, Windsurf, and others. Claude Code reads only `CLAUDE.md` ([issue #6235](https://github.com/anthropics/claude-code/issues/6235), 4,000+ 👍, still open). The common workarounds either break on Windows (symlinks need Developer Mode) or force a `CLAUDE.md` into your repo. This plugin avoids both.

- **Website:** <https://patrickrutledge.github.io/agents-md-bridge/>
- **Privacy:** collects no data — <https://patrickrutledge.github.io/agents-md-bridge/privacy.html>

## How it works

On every session start, a hook walks your project tree and, next to each `AGENTS.md`, writes a `CLAUDE.md` containing a single line:

```
@AGENTS.md
```

That's a Claude Code **import**, so `AGENTS.md` remains the single source of truth — nothing is copied, nothing can drift. Claude's own memory system then loads it natively, including the per-directory nesting and `@`-imports you'd get from a real `CLAUDE.md`.

The generated files are added to **`.git/info/exclude`** (a *local* ignore), so nothing Claude-branded is ever committed and your tracked `.gitignore` is untouched.

## Guarantees

- **Your own `CLAUDE.md` is never touched.** The plugin only creates or overwrites files carrying its `agents-md-bridge:auto` marker. A hand-written `CLAUDE.md` is left exactly as-is.
- **Cross-platform.** Pure file I/O via Node — no symlinks, works on Windows/macOS/Linux.
- **Self-healing.** Regenerated each session, so it tracks `AGENTS.md` files as you add or remove them.
- **Quiet.** Emits one suppressed status line (e.g. `agents-md-bridge: 2 linked — AGENTS.md is now active.`).
- **Scoped.** Skips `node_modules`, `.git`, `dist`, `build`, and other noise; depth-capped.
- **Zero data collection.** No network, no telemetry. See [PRIVACY.md](./PRIVACY.md).

## Install

Inside a Claude Code session (these are interactive slash commands, **not** terminal commands):

```
/plugin marketplace add PatrickRutledge/agents-md-bridge
/plugin install agents-md-bridge@aetherforge
```

Requires Node.js (already present with any Claude Code install).

## Requirements & limits

- The git-ignore step assumes the project root is the git root.
- Generated `CLAUDE.md` files persist after a session (harmless and git-ignored); they're refreshed on the next start.

## License

[MIT](./LICENSE)
