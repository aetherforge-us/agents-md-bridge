#!/usr/bin/env node
/**
 * agents-md-bridge — SessionStart hook
 *
 * Makes Claude Code read AGENTS.md without forcing a committed CLAUDE.md into the repo.
 * For every AGENTS.md in the project tree, it ensures a sibling CLAUDE.md exists whose
 * sole content is `@AGENTS.md` (a Claude Code import). Because it's an import, AGENTS.md
 * stays the single source of truth — no content is copied, so the two can never drift.
 *
 * Generated files carry a marker comment. We ONLY ever create or overwrite files that
 * carry that marker, so a CLAUDE.md you wrote by hand is never touched. Generated paths
 * are added to .git/info/exclude (a LOCAL ignore) so nothing Claude-branded gets committed.
 *
 * Regenerated every session, so it self-heals as AGENTS.md files are added or removed.
 */

const fs = require("fs");
const path = require("path");

const MARKER = "agents-md-bridge:auto";
const GENERATED = `<!-- ${MARKER} — generated each session from AGENTS.md. Do not edit or commit. -->\n@AGENTS.md\n`;

// Directories we never descend into when scanning for AGENTS.md.
const SKIP_DIRS = new Set([
  ".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
  "out", "target", "vendor", ".next", ".nuxt", ".cache", "coverage",
  ".idea", ".vscode", ".terraform", "bin", "obj",
]);
const MAX_DEPTH = 12;

function readStdin() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

/** Resolve the project root: env var set by Claude Code, else the hook payload cwd, else process cwd. */
function resolveProjectDir(payload) {
  return process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd();
}

/** Recursively collect directories that contain an AGENTS.md. */
function findAgentsDirs(root) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > MAX_DEPTH) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === "AGENTS.md")) {
      found.push(dir);
    }
    for (const e of entries) {
      if (e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) {
        walk(path.join(dir, e.name), depth + 1);
      }
    }
  };
  walk(root, 0);
  return found;
}

/** Returns "created" | "updated" | "skipped-user" | "unchanged". */
function ensureBridge(dir) {
  const claudePath = path.join(dir, "CLAUDE.md");
  if (fs.existsSync(claudePath)) {
    const existing = fs.readFileSync(claudePath, "utf8");
    if (!existing.includes(MARKER)) return "skipped-user"; // hand-written — never touch
    if (existing === GENERATED) return "unchanged";
    fs.writeFileSync(claudePath, GENERATED);
    return "updated";
  }
  fs.writeFileSync(claudePath, GENERATED);
  return "created";
}

/** Add generated CLAUDE.md paths to .git/info/exclude inside a managed block (local-only ignore). */
function updateGitExclude(root, generatedPaths) {
  const excludePath = path.join(root, ".git", "info", "exclude");
  const gitInfoDir = path.join(root, ".git", "info");
  if (!fs.existsSync(path.join(root, ".git")) || !fs.existsSync(gitInfoDir)) return;

  const BEGIN = "# >>> agents-md-bridge >>>";
  const END = "# <<< agents-md-bridge <<<";
  const rel = generatedPaths
    .map((p) => "/" + path.relative(root, p).split(path.sep).join("/"))
    .sort();
  const block = [BEGIN, ...rel, END].join("\n");

  let content = "";
  try {
    content = fs.readFileSync(excludePath, "utf8");
  } catch {
    /* exclude file may not exist yet */
  }
  const re = new RegExp(`${BEGIN}[\\s\\S]*?${END}\\n?`, "m");
  if (re.test(content)) {
    content = content.replace(re, rel.length ? block + "\n" : "");
  } else if (rel.length) {
    content = (content.trimEnd() + "\n\n" + block + "\n").replace(/^\n+/, "");
  }
  try {
    fs.writeFileSync(excludePath, content);
  } catch {
    /* read-only or unusual setup — non-fatal */
  }
}

function main() {
  const payload = readStdin();
  const root = resolveProjectDir(payload);

  const dirs = findAgentsDirs(root);
  const generated = [];
  let created = 0, updated = 0, skipped = 0;

  for (const dir of dirs) {
    const result = ensureBridge(dir);
    if (result === "skipped-user") {
      skipped++;
      continue;
    }
    generated.push(path.join(dir, "CLAUDE.md"));
    if (result === "created") created++;
    else if (result === "updated") updated++;
  }

  updateGitExclude(root, generated);

  // Build a quiet status line for the user. No additionalContext needed — Claude's own
  // memory system loads the generated CLAUDE.md files natively.
  let msg;
  if (dirs.length === 0) {
    msg = "agents-md-bridge: no AGENTS.md found.";
  } else {
    const parts = [];
    if (created) parts.push(`${created} linked`);
    if (updated) parts.push(`${updated} refreshed`);
    if (skipped) parts.push(`${skipped} skipped (your own CLAUDE.md)`);
    msg = `agents-md-bridge: ${parts.join(", ") || "up to date"} — AGENTS.md is now active.`;
  }

  process.stdout.write(
    JSON.stringify({
      continue: true,
      suppressOutput: true,
      systemMessage: msg,
    })
  );
}

main();
