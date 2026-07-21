/**
 * lib/clipboard.ts — Safe cross-environment clipboard write helper.
 *
 * Abstracts away two clipboard strategies:
 *   1. Modern `navigator.clipboard.writeText` (requires a secure context / HTTPS).
 *   2. Legacy `document.execCommand("copy")` fallback for sandboxed iframes,
 *      HTTP pages, and older browsers where the Clipboard API is unavailable.
 *
 * Always call this instead of `navigator.clipboard.writeText` directly so the
 * app works consistently inside the v0 preview iframe.
 */

/**
 * Write `text` to the system clipboard.
 *
 * Tries the modern Clipboard API first. If that throws (e.g. permissions
 * denied, sandboxed iframe), transparently falls back to the `execCommand`
 * strategy. Rejects only if both strategies fail.
 *
 * @param text - The string to copy to the clipboard.
 * @returns A Promise that resolves when the copy succeeds, or rejects with
 *   an `Error` if neither strategy is available.
 *
 * @example
 * await copyToClipboard(apiKey)
 * setCopied(true)
 */
export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(text).catch(() => execCommandFallback(text))
  }
  return execCommandFallback(text)
}

/**
 * Legacy clipboard write via `document.execCommand("copy")`.
 *
 * Creates an off-screen `<textarea>`, selects its content, fires the
 * deprecated `copy` command, and immediately removes the element. This
 * approach works in sandboxed iframes and older browsers where the modern
 * Clipboard API is blocked.
 *
 * @param text - The string to copy.
 * @returns Resolves on success, rejects if `execCommand` is unavailable.
 * @internal — only called as a fallback from `copyToClipboard`.
 */
function execCommandFallback(text: string): Promise<void> {
  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0"
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    document.execCommand("copy")
    document.body.removeChild(ta)
    return Promise.resolve()
  } catch {
    return Promise.reject(new Error("Copy not supported in this environment"))
  }
}
