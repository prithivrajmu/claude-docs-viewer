export type DocsView = {
  /** .md/.mdx/.markdown/.html/.txt paths relative to the working directory, scanned when /docs ran. Not node_modules, .git or other build folders. */
  files: string[]
  /** Folder names under .claude/worktrees. */
  worktrees: string[]
  /** The worktree opened in the list, or ''. */
  openWt: string
  /** The opened worktree's files, relative to the working directory. */
  wtFiles: string[]
  /** Release notes (*.md) kept outside the repo in ~/.claude/release-notes/<package.json name>, absolute paths, newest version first. */
  notes: string[]
  /** The file being read, or null for the list. */
  path: string | null
  text: string
  note: string
}

declare module 'claude-code' {
  interface PluginState {
    'repo-docs': { view: DocsView; isReceiptOn: boolean }
  }
}
