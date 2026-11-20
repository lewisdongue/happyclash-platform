/**
 * Phones scroll the whole page up to keep a focused field above the keyboard.
 * When the field closes with its sheet (sign up, log in, edit profile), the page
 * can stay shifted and fixed headers end up half off screen until a reload.
 * Once no field is focused, we put the page back where it belongs.
 */
export function keepViewportInPlace() {
  const isField = (element: Element | null) =>
    element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement || (element instanceof HTMLElement && element.isContentEditable)

  const settle = () => {
    if (isField(document.activeElement)) return
    const root = document.documentElement
    const pageCanScroll = root.scrollHeight > window.innerHeight + 1 && getComputedStyle(root).overflowY !== 'hidden'
    // A scrollable page keeps the reader's position; a locked screen must sit at the top.
    if (!pageCanScroll && window.scrollY !== 0) window.scrollTo(0, 0)
  }

  document.addEventListener('focusout', () => window.setTimeout(settle, 150))
  window.visualViewport?.addEventListener('resize', () => window.setTimeout(settle, 150))
}
