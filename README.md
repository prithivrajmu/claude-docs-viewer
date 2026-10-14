# claude-docs-viewer

A Claude Code mod. `/docs` opens a pane that lists every Markdown file (`.md`, `.mdx`, `.markdown`) in the current repo, plus `.html` and `.txt` files. Click a file to read it (Markdown is rendered, the others are shown as code), click **< Back** to return to the list.

`node_modules`, `.git`, `.next`, `dist`, `build` and `coverage` are skipped.

Worktrees under `.claude/worktrees/` show as a collapsed group. Click a worktree to scan and list its files.

If the repo has a `package.json`, Markdown files in `~/.claude/release-notes/<package name>/` are listed too, newest version first, under "Release notes".

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
