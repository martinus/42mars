# Checklist for agent files

From Anthropic's pages, read 12th November 2026. Refresh when older than 90 days or on `/wrap-up refresh`: update the rules below, the date, and say what changed.

Sources (Markdown, 50 to 120 KB each; `WebFetch` returns the whole page, which lands in the closed tool-results folder: `curl -sL -o <scratchpad>/<page>.md <url>.md`, then `grep -n '^#'` and read sections with `sed -n`):
- https://code.claude.com/docs/en/best-practices ("Deterministic and non-deterministic instructions", "Keep CLAUDE.md short", "Scope rules to one part of the codebase", "Put team procedures in skills", "Keep cost and context down")
- https://code.claude.com/docs/en/memory ("Write effective instructions", "How CLAUDE.md files load", "Path-specific rules", "Troubleshoot memory issues")
- https://code.claude.com/docs/en/skills (frontmatter reference, "Add supporting files", "Skill descriptions are cut short")
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices (the checklist at its end)

## What is loaded when

- Every session: `CLAUDE.md` of the working directory and of every folder above it, `~/.claude/CLAUDE.md`, rules without `paths`, and the description of every skill the model may start. Each line there costs attention on every task.
- When a matching file is read or edited: a rule with `paths`. After a compaction it loads again only on the next match.
- When it runs: a skill's body, then it stays in context for the rest of the session. Its other files when read. Its scripts never: only their output.
- A skill with `disable-model-invocation: true` costs nothing until Martin starts it. The model cannot start it through the Skill tool; another skill reads its `SKILL.md` instead.
- `@import` in `CLAUDE.md` loads with it and saves nothing.

## Rules

1. `CLAUDE.md` holds what an agent cannot get from the code and needs in most sessions: commands to check work, where the code misleads, decisions that are not in the repository, what had to be corrected twice. Under 200 lines per file; longer files are followed less.
2. For each line: would an agent make a mistake without it? If not, delete it. Delete what the code shows (layouts, dependency lists, architecture overviews); keep pitfalls, reasons, and conventions that differ from defaults.
3. A rule for one part of the code goes into `.claude/rules/` with `paths`. A procedure of several steps goes into a skill.
4. An instruction is concrete enough to check: "run `npm test` before a commit", not "test the change".
5. Two instructions that contradict each other: the agent picks one. One fact in one place, the other places point to it.
6. A line that is missed although it is there: do not add emphasis. Either the file is too long, or it has to happen every time, then it is a hook, a deny rule or a CI check, not a sentence. A hook for a mere preference is deleted.
7. Skill description: third person, what it does and when to use it, the key use first (cut at 1,536 characters). Body under 500 lines, further files one level deep and linked from `SKILL.md`, a table of contents in a file over 100 lines.
8. A fixed step of a skill is a script that is run, not text that is read: it handles its errors itself and has no unexplained constants. The text says "run" or "read".
9. A skill with steps that must not be skipped has a checklist to copy and tick.
10. No dates that make a rule wrong later ("until March use X"); a dated incident as the reason of a rule is fine. One term per thing.
11. Nothing for human readers: no introduction, no summary, no repeat of `README.md`. An HTML comment in `CLAUDE.md` is stripped before loading and costs nothing.
12. A change needs a reason from this list or from the session. No rewording for taste.

Only Martin can run these, name them in the report when they would help: `/doctor prompt-audit` (stale and contradicting instructions, proposes edits), `/doctor` (cuts for `CLAUDE.md`, the cost of the skill listing), `/context all` (what is loaded).
