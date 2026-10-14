# claude-docs-viewer

A Claude Code mod. `/docs` opens a pane that lists every Markdown file (`.md`, `.mdx`, `.markdown`) in the current repo, plus `.html` and `.txt` files. Click a file to read it (Markdown is rendered, the others are shown as code), click **< Back** to return to the list.

`node_modules`, `.git`, `.next`, `dist`, `build` and `coverage` are skipped.

Worktrees under `.claude/worktrees/` show as a collapsed group. Click a worktree to scan and list its files.

If the repo has a `package.json`, Markdown files in `~/.claude/release-notes/<package name>/` are listed too, newest version first, under "Release notes".

## /receipt

Shows a one-line receipt under each answer: how long the turn took, how many tool calls it made, and the tokens when the API reports them. On by default; `/receipt` toggles it.

## secret-shield

Redacts AWS, GitHub, Slack, Anthropic and OpenAI keys, private key blocks, and `password=` / `token=` style values from tool output before Claude reads it. A "shield: redacted N secrets" toast says when it did.

## blast-radius

Holds destructive Bash commands (`rm -r`, `git reset --hard`, `git push --force`, `git clean -f`, `DROP TABLE`, `kubectl delete`) and asks you to confirm. For `rm` it shows what the command would hit. No answer in 60 s cancels it. It is a regex matcher, so a quoted or aliased command can slip past.

## /park [note]

Saves where you left off (note, branch, last prompt) to `~/.claude/park/<repo>.json`. The next session in that repo shows a "Parked: <note> (2d ago)" band above the prompt with **Dismiss**. `/park clear` deletes it.

## Install

At the prompt of a terminal session:

```
/plugin install repo-docs --marketplace prithivrajmu/claude-docs-viewer
```

From a shell:

```
claude plugin install repo-docs --marketplace prithivrajmu/claude-docs-viewer
```

Answer `y` to add the marketplace, then pick a scope.

## Develop

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```
