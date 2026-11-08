# The pull request loop

The `gh` calls that take a change from a branch to a merged pull request and
back onto `main`, in order. Repository: `martinus/corewar-theater`.

1. **Branch and commit**: one branch per PR from `origin/main` (`git fetch origin main && git switch -c issue-<n>-<slug> origin/main`). Commit message `area: what changed`, then why and the numbers (see `git log`); no Claude attribution.
2. **Push and create**: `git push -u origin <branch>`, then `gh pr create --base main --head <branch> --title ... --body-file <file>`. Write the body to a file in the scratchpad first: the clean-room hook reads command text, and a body that names a blocked path or branch gets the command refused. The body lists the checks you ran with their results (pMARS checks, numbers before and after).
3. **Closing keywords only for what the PR finishes.** GitHub closes an issue for `Fixes #N`, `Closes #N` or `Resolves #N` anywhere in the PR body or a commit message, also inside quotes or tables. A PR that does part of an issue names it by number only ("part of #N") and the issue body is updated to what is left (`gh issue edit N --body-file ...`).
4. **Watch CI**: `gh pr checks <n> --watch --interval 15`. Right after `gh pr create` it can print "no checks reported"; wait a few seconds and run it again. For a failure: `gh run view <run-id> --log-failed`.
5. **Merge on green**: `gh pr merge <n> --rebase --match-head-commit $(git rev-parse HEAD)`. If the head moved, read the checks again on the new head; never force.
6. **Check what it closed**: `gh issue list --state open --author martinus`. Close each issue the PR finished that is still open: `gh issue close N --reason completed --comment "<what landed, numbers>"`. A speed idea that was measured and rejected is closed with `--reason "not planned"` and the numbers, after its log entry is merged.
7. **Back onto main**: `git fetch origin main && git switch -c <next-branch> origin/main`. Leave the merged branch alone; `gra done` cleans up worktrees, and only Martin runs it.
8. **Read the issue list again** (step 1 of the skill).
