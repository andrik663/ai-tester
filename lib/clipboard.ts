/**
 * copyToClipboard — safe clipboard write that falls back to execCommand
 * when the modern Clipboard API is blocked (e.g. sandboxed iframes in v0 preview).
 */
export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(text).catch(() => execCommandFallback(text))
  }
  return execCommandFallback(text)
}

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
