/**
 * Dev-only language/RTL toggle for hardcoded Hebrew UI chrome (nav labels,
 * headers, buttons — never lesson content/data, which must stay real Hebrew
 * for the features that grade/match against it to mean anything). Wrap a
 * literal string with t() and it renders in English or Hebrew depending on
 * the toggle (DevLangToggle) during `next dev`; always plain Hebrew in
 * production. Next.js statically replaces `NODE_ENV` at build time, so the
 * `isDev` check is dead-code eliminated from production bundles — zero prod
 * cost.
 *
 * Add new entries to dev-i18n-dict/en.json as you wrap more UI chrome. A
 * missing entry isn't an error — t() falls back to the original Hebrew and
 * logs a console warning (dev-only) so gaps are discoverable without
 * breaking the page.
 *
 * HOW THE TOGGLE STAYS HYDRATION-SAFE: `clientOverride` below starts at
 * `null` and is ONLY ever written to from browser code (DevLangProvider's
 * effect, DevLangToggle's click handler) — server-side rendering never
 * touches it, so t() always computes the same isDev-only default during
 * SSR and during React's first client hydration pass (both see `null`).
 * Only AFTER hydration does an effect flip `clientOverride`, which notifies
 * `DevLangProvider` to remount its children with a new `key` — a normal
 * client-side re-render, not a hydration comparison, so React has no
 * grounds to warn. An earlier version tried to read a cookie directly
 * inside t() during render instead, which server and client disagreed on
 * (Client Components can't see a request's cookies during their SSR pass)
 * and produced real hydration mismatches — that's why this indirection
 * exists instead of a simpler-looking direct check.
 *
 * KNOWN LIMITATION: the five files where t() is called from a Server
 * Component (layout.tsx's metadata, PageHeader.tsx, monitor/page.tsx, and
 * the two QuestionMap.tsx files) can never react to the toggle — Server
 * Components render once on the server and nothing client-side can
 * re-invoke them. Dev-only, low stakes.
 */
import EN from './dev-i18n-dict/en.json'

export const isDev = process.env.NODE_ENV === 'development'

export const DEV_LANG_COOKIE = 'dev-lang'
export type DevLang = 'he' | 'en'

/** Browser-only. Never assigned during SSR — see the module doc comment above. */
let clientOverride: DevLang | null = null
const listeners = new Set<() => void>()

export function getDevLang(): DevLang {
  return clientOverride ?? (isDev ? 'en' : 'he')
}

/** Client-only. Updates the shared language, the html attributes, and the persistence cookie, then notifies subscribers. */
export function setDevLang(lang: DevLang) {
  clientOverride = lang
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
  document.cookie = `${DEV_LANG_COOKIE}=${lang}; path=/; max-age=31536000; SameSite=Lax`
  listeners.forEach(fn => fn())
}

export function subscribeDevLang(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function t(hebrew: string): string {
  if (!isDev) return hebrew
  if (getDevLang() === 'he') return hebrew

  const translated = (EN as Record<string, string>)[hebrew]
  if (translated === undefined) {
    console.warn(`[dev-i18n] missing translation for: "${hebrew}"`)
    return hebrew
  }
  return translated
}
