---
name: wrap-up
description: Ends a session. Reflects on what cost time, lands the fixes in the agent files and in scripts, trims the agent files against Anthropic's guidance, and leaves the repository ready for /clear. Run only when Martin types /wrap-up or says "wrap up"; the issues skill ends with it.
argument-hint: "[refresh: read Anthropic's pages again first]"
disable-model-invocation: true
---

# Wrap up

The next session starts from the repository alone. Make it cheaper and better than this one, and leave nothing it needs in this context.

**`/wrap-up` is the permission to commit, push, open one pull request and merge it on green**, when the pull request touches only `CLAUDE.md`, `.claude/`, scripts in `tools/` or `bench/`, and their tests. **Ask first** about the clean-room hook, the clean-room rule and any line that says what the hook blocks; about anything that changes what a check proves; and about everything else.

Agent files are read by agents only, never by a person. A lesson that is not in a tracked file (or in `~/gra/CLAUDE.md`) does not exist: Martin switches computers, and the machine-local memory folder stays behind. Never write there and never read it: it is below `~/.claude/projects/`, which the clean-room rule closes.

Copy this list and tick each step:

```
- [ ] 1. Sizes before
- [ ] 2. Reflect
- [ ] 3. Land
- [ ] 4. Trim
- [ ] 5. Check, pull request, merge on green
- [ ] 6. Ready for /clear
- [ ] 7. Report
```

## 1. Sizes before

Run `node .claude/skills/wrap-up/agent-files.mjs` and keep the three totals. With the argument `refresh`, or when the date in [practices.md](practices.md) is older than 90 days, refresh that file first as it describes.

## 2. Reflect

From what happened in this session, not from opinion. After a compaction, say that the time before it is covered only as far as the summary holds it.

- a tool call that was refused or blocked, and why
- a test, a check or a CI run that went red, and what fixed it
- a measurement that had to be repeated because the machine was busy or the method was wrong
- a question Martin answered twice, or a correction he made
- a file read whole to find one fact; a command or script put together from nothing more than once
- a tool that accepted wrong input and gave a result that looked real
- a rule that was wrong, stale or not followed; a rule that cost reading and saved nothing

For each finding: the evidence (the command, the message), what it cost, and the change that stops it. Nothing went wrong: say so in one line and go to step 4.

## 3. Land

The smallest change per finding. Removing a line counts as much as adding one.

| The finding is | It goes into |
|---|---|
| a way of working, a command or a gotcha for the whole repository | `CLAUDE.md` |
| a rule for one part of the code | `.claude/rules/<area>.md` (loads with its `paths`) |
| a step of a procedure | that skill |
| true in every repository under `~/gra` | `~/gra/CLAUDE.md`: outside the repository, edit it directly, name the edit in the report |
| a command that was put together more than once | a script: `tools/` or `bench/` when users of the engine need it too, else in the folder of the skill that runs it |
| a tool that misled | the tool: it refuses the input. Not a rule that warns about the tool |
| a defect or unfinished product work | an issue in Martin's voice (`~/gra/martin-voice.md`), not a rule |

- Grep before adding (`grep -rn <symbol> CLAUDE.md .claude/`): extend the bullet that covers it already.
- A rule is the instruction and one line of reason.
- A script has the MIT header, no dependencies, refuses unknown options, and gets a test in `test/` that is proven by a mutation; one line in the agent file that needs it names it.

## 4. Trim

Read [practices.md](practices.md) and go through the agent files with it: `CLAUDE.md` first (every session pays for it), then `.claude/rules/`, then the skills. Run `agent-files.mjs` again: fix every stale reference (the new name, or delete the line), and for each duplicate line keep one place.

- A change needs a reason from the checklist or from step 2. No rewording for taste.
- Never drop a rule because it is long: shorten it to the instruction and its reason.
- `~/gra/CLAUDE.md` gets what step 3 lands, never a trim: other repositories read it.

## 5. Check, pull request, merge on green

Nothing changed: no pull request, go to step 6.

1. `node .claude/skills/wrap-up/agent-files.mjs --check` ends with 0 stale references, and `npm test` passes.
2. Uncommitted work that is not part of the wrap-up: commit it to its own branch or ask. Then a branch `wrap-up-<yyyy-mm-dd>` from `origin/main`.
3. The pull request body lists every added, changed and removed line with its reason and evidence, every removed rule in full, and the table of `agent-files.mjs` with the change against `origin/main`. If the bytes loaded in every session grew, it says why they had to.
4. Push, CI and merge: steps 2 to 5 of [the pull request loop](../issues/pull-request-loop.md).

## 6. Ready for /clear

- Background jobs of this session have ended (PIDs from `$!`).
- Nothing left behind: copies like `tools/zz-*`, and folders that tools keep after a failure (`pmars-diff-*` in the system's temporary folder): remove each by the name the tool printed. A glob over `/tmp` was refused, it can hit other sessions' folders.
- `git status` is clean, or the uncommitted work is named and Martin is asked. Never discard it, never stash it.
- Open work is in its issue (edit the body to what is left) or in a new one. A pull request that waits on Martin is named.
- The worktree stays; `gra done` is Martin's.

## 7. Report

Short: each finding with what landed (the pull request), every removed rule, the size totals before and after, what was asked and what waits on Martin. Name `/doctor prompt-audit` when instructions seem to contradict each other in a way the script cannot see. The last line is "Ready for /clear." or what still blocks it.
