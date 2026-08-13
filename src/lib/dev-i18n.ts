/**
 * Dev-tooling gate for hardcoded Hebrew UI chrome (nav labels, headers,
 * buttons — never lesson content/data, which must stay real Hebrew for the
 * features that grade/match against it to mean anything), plus the Dev
 * Panel and its QA tools (answer hints, Naale session-length override, and
 * the debug-only routes under src/app/api/naale/dev/).
 *
 * `debugMode` is sourced from NEXT_PUBLIC_DEBUG_MODE, not NODE_ENV — this
 * used to be a plain `NODE_ENV === 'development'` check (so it could only
 * ever be true under `next dev`), but that meant there was no way to turn
 * dev tooling on for a deployed build without redeploying out of production
 * mode entirely. NEXT_PUBLIC_* is still statically inlined by Next.js at
 * build time exactly like NODE_ENV was, so the same "dead-code-eliminated
 * when off" property holds — the difference is only which knob controls
 * it. It's still a BUILD-TIME flag: flipping NEXT_PUBLIC_DEBUG_MODE in
 * Vercel requires a redeploy to take effect, not just an env var edit. See
 * .env.example and the dev-panel-in-production ticket for the full
 * reasoning, including why this must never be set true on the real
 * production project (it removes the server-side correct_answer strip and
 * the session-length guard for every visitor to that build, not just an
 * admin).
 *
 * Add new entries to dev-i18n-dict/en.json as you wrap more UI chrome. A
 * missing entry isn't an error — t() falls back to the original Hebrew and
 * logs a console warning (dev-only) so gaps are discoverable without
 * breaking the page.
 *
 * HOW THE TOGGLE STAYS HYDRATION-SAFE: `clientOverride` below starts at
 * `null` and is ONLY ever written to from browser code (DevLangProvider's
 * effect, DevLangToggle's click handler) — server-side rendering never
 * touches it, so t() always computes the same debugMode-only default
 * during SSR and during React's first client hydration pass (both see
 * `null`). Only AFTER hydration does an effect flip `clientOverride`, which
 * notifies `DevLangProvider` to remount its children with a new `key` — a
 * normal client-side re-render, not a hydration comparison, so React has no
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

export const debugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'

export const DEV_LANG_COOKIE = 'dev-lang'
export type DevLang = 'he' | 'en'

/** Browser-only. Never assigned during SSR — see the module doc comment above. */
let clientOverride: DevLang | null = null
const listeners = new Set<() => void>()

export function getDevLang(): DevLang {
  return clientOverride ?? (debugMode ? 'en' : 'he')
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
  if (!debugMode) return hebrew
  if (getDevLang() === 'he') return hebrew

  const translated = (EN as Record<string, string>)[hebrew]
  if (translated === undefined) {
    console.warn(`[dev-i18n] missing translation for: "${hebrew}"`)
    return hebrew
  }
  return translated
}
