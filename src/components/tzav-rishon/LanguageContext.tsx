'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type Language = 'he' | 'ar'

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

/**
 * Plain in-memory state — no localStorage, no cookie. Resets to Hebrew on
 * every fresh page load (deliberate: avoids any hydration-mismatch risk
 * since nothing is read from storage during the initial render, and avoids
 * the page-reload cost of this app's other cookie+reload toggle pattern —
 * a reload per language switch would contradict the "seamless" requirement
 * for this feature).
 *
 * Lives in the shared /tzav-rishon layout, so it persists across
 * /tzav-rishon <-> /tzav-rishon/[topic] navigation (the layout doesn't
 * remount between sibling routes it wraps) without needing a URL param.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('he')
  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider (src/app/tzav-rishon/layout.tsx)')
  return ctx
}
