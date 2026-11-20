/**
 * Site language. The interface is written in English; other languages are
 * rendered by the browser-side Google translation layer, which also covers
 * text loaded later (Clashes, legal pages, toasts). First visit follows the
 * browser language; the choice is then remembered.
 */
export const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'fr', name: 'Français' },
  { id: 'de', name: 'Deutsch' },
  { id: 'es', name: 'Español' },
  { id: 'hi', name: 'हिन्दी' },
] as const
export type Language = (typeof LANGUAGES)[number]['id']

const KEY = 'hc:language'

function fromBrowser(): Language {
  for (const tag of navigator.languages ?? [navigator.language]) {
    const id = tag.slice(0, 2).toLowerCase()
    if (LANGUAGES.some((language) => language.id === id)) return id as Language
  }
  return 'en'
}

export function currentLanguage(): Language {
  try {
    const saved = localStorage.getItem(KEY) as Language | null
    if (saved && LANGUAGES.some((language) => language.id === saved)) return saved
  } catch {
    /* storage unavailable */
  }
  return fromBrowser()
}

function writeCookie(language: Language) {
  const value = language === 'en' ? '' : `/en/${language}`
  const expires = language === 'en' ? 'expires=Thu, 01 Jan 1970 00:00:00 GMT' : 'max-age=31536000'
  for (const domain of ['', `; domain=.${location.hostname.replace(/^www\./, '')}`]) {
    document.cookie = `googtrans=${value}; path=/; ${expires}${domain}`
  }
}

export function setLanguage(language: Language) {
  try {
    localStorage.setItem(KEY, language)
  } catch {
    /* storage unavailable */
  }
  writeCookie(language)
  location.reload()
}

/** The translation layer rewrites text nodes React owns; make React tolerant of that. */
function shieldReact() {
  const removeChild = Node.prototype.removeChild
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child
    return removeChild.call(this, child) as T
  }
  const insertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, reference: Node | null): T {
    if (reference && reference.parentNode !== this) return insertBefore.call(this, node, null) as T
    return insertBefore.call(this, node, reference) as T
  }
}

export function startTranslation() {
  const language = currentLanguage()
  document.documentElement.lang = language
  writeCookie(language)
  if (language === 'en') return
  shieldReact()
  const host = document.createElement('div')
  host.id = 'google_translate_element'
  host.style.display = 'none'
  document.body.appendChild(host)
  ;(window as unknown as Record<string, unknown>).googleTranslateInit = () => {
    const google = (window as unknown as { google: { translate: { TranslateElement: new (options: object, id: string) => unknown } } }).google
    new google.translate.TranslateElement({ pageLanguage: 'en', includedLanguages: 'fr,de,es,hi', autoDisplay: false }, 'google_translate_element')
  }
  const script = document.createElement('script')
  script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateInit'
  script.async = true
  document.head.appendChild(script)
}
