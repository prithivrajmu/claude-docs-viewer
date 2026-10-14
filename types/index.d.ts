export type DocsView = {
  /** Paths relative to the working directory, scanned when /docs ran. */
  files: string[]
  /** Release notes (*.md) kept outside the repo in ~/.claude/release-notes/<package.json name>, absolute paths, newest version first. */
  notes: string[]
  /** The file being read, or null for the list. */
  path: string | null
  text: string
  note: string
}

declare module 'claude-code' {
  interface PluginState {
    'repo-docs': { view: DocsView }
  }
}
