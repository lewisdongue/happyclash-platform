const RELOAD_KEY = 'hc:chunk-reload'

/** True for the errors a browser throws when a lazily loaded file of an older build is gone. */
export function isStaleBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message)
}

/**
 * After a deploy, a tab still running the previous build asks for files that
 * no longer exist. Reloading once fetches the new build; the flag stops a loop
 * if the reload does not help.
 */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Without storage we still reload once; the next failure shows the error page.
  }
  window.location.reload()
  return true
}
