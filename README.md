# claude-docs-viewer

A Claude Code mod. `/docs` opens a pane that lists `CHANGELOG.md` and every `docs/**/*.md` in the current repo. Click a file to read it as rendered Markdown, click **< Back** to return to the list.

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
