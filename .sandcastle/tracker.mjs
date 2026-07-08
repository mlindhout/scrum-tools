#!/usr/bin/env node
// Local Markdown issue tracker adapter for Sandcastle.
//
// Issues live as markdown files under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`
// (see docs/agents/issue-tracker.md). There is no external service and no auth:
// every operation reads and writes files in the git worktree.
//
// Subcommands (invoked from the .sandcastle/*.md prompt files):
//   list          Print all open, agent-ready issues as a JSON array.
//                 Shape matches the built-in trackers: [{ id, title, body }].
//   view <ID>     Print a single issue's raw markdown.
//   close <ID>    Mark a single issue closed (sets its Status: line).
//
// The `id` is a stable, slash-free handle: `<feature-slug>__<NN>`. The tracker
// owns both directions of the id<->path mapping, so callers never construct paths.

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SCRATCH_DIR = ".scratch";
// An issue is listed only when its Status line holds this role (see
// docs/agents/triage-labels.md). Closing an issue moves it out of this state.
const READY_STATUS = "ready-for-agent";
const CLOSED_STATUS = "closed";

const ID_SEPARATOR = "__";

/** Read the `Status:` value from an issue body, or "" if absent. */
function parseStatus(text) {
  const match = text.match(/^\s*Status:\s*(.+?)\s*$/im);
  return match ? match[1].trim() : "";
}

/**
 * Derive a human title. Prefer the issue file's top-level `# ` heading; the
 * `## What to build` etc. sections are h2 and are correctly skipped. Fall back
 * to the filename slug (strip the `NN-` prefix, dashes to spaces) so a metadata
 * line like `Status:` is never mistaken for the title.
 */
function parseTitle(text, slug) {
  const heading = text.match(/^#\s+(.+?)\s*$/m);
  if (heading) return heading[1].trim();
  return slug.replace(/^\d+[-_]?/, "").replace(/[-_]+/g, " ").trim() || slug;
}

/** Enumerate every issue file across all feature directories. */
function collectIssues() {
  const issues = [];
  let features;
  try {
    features = readdirSync(SCRATCH_DIR, { withFileTypes: true });
  } catch {
    return issues; // No .scratch yet — no issues.
  }

  for (const feature of features) {
    if (!feature.isDirectory()) continue;
    const issuesDir = join(SCRATCH_DIR, feature.name, "issues");
    let files;
    try {
      files = readdirSync(issuesDir);
    } catch {
      continue; // Feature dir without an issues/ subdir (e.g. just a PRD).
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      const path = join(issuesDir, file);
      if (!statSync(path).isFile()) continue;

      const slug = file.replace(/\.md$/, "");
      const number = (slug.match(/^(\d+)/) || [])[1] || slug;
      const text = readFileSync(path, "utf8");

      issues.push({
        id: `${feature.name}${ID_SEPARATOR}${number}`,
        title: parseTitle(text, slug),
        body: text,
        status: parseStatus(text),
        path,
      });
    }
  }
  return issues;
}

/** Find one issue by id, or exit(1) with an error. */
function requireIssue(id) {
  const issue = collectIssues().find((i) => i.id === id);
  if (!issue) {
    console.error(`Issue not found: ${id}`);
    process.exit(1);
  }
  return issue;
}

function cmdList() {
  const open = collectIssues()
    .filter((i) => i.status === READY_STATUS)
    .map(({ id, title, body }) => ({ id, title, body }));
  console.log(JSON.stringify(open, null, 2));
}

function cmdView(id) {
  process.stdout.write(requireIssue(id).body);
}

function cmdClose(id) {
  const issue = requireIssue(id);
  const statusLine = `Status: ${CLOSED_STATUS}`;
  const updated = /^\s*Status:.*$/im.test(issue.body)
    ? issue.body.replace(/^\s*Status:.*$/im, statusLine)
    : `${statusLine}\n${issue.body}`;
  writeFileSync(issue.path, updated);
  console.log(`Closed ${id} (${issue.path})`);
}

const [command, id] = process.argv.slice(2);

switch (command) {
  case "list":
    cmdList();
    break;
  case "view":
    if (!id) { console.error("Usage: tracker.mjs view <ID>"); process.exit(1); }
    cmdView(id);
    break;
  case "close":
    if (!id) { console.error("Usage: tracker.mjs close <ID>"); process.exit(1); }
    cmdClose(id);
    break;
  default:
    console.error("Usage: tracker.mjs <list|view|close> [ID]");
    process.exit(1);
}
