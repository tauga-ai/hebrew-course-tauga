'use client'

import { createContext, useContext, useSyncExternalStore, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'

const THEME_COOKIE = 'theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax`
}

// The DOM attribute is the single source of truth (it can be mutated by the
// no-cookie inline script in layout.tsx's <head>, not just by toggleTheme
// below) — a MutationObserver + useSyncExternalStore keeps React in sync
// with it without ever calling setState from inside an effect body.
function subscribeToThemeAttribute(callback: () => void) {
  const observer = new MutationObserver(callback)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

function getThemeSnapshot(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

/**
 * No server-provided initial value on purpose (see layout.tsx) — the server
 * snapshot below is always 'light', matching the static server-rendered
 * HTML, which never sets data-theme itself. The blocking inline script in
 * layout.tsx's <head> may already have set data-theme="dark" pre-paint; if
 * so, useSyncExternalStore picks that up right after hydration (a one-frame
 * icon-only discrepancy in ThemeToggle at most — page colors are correct
 * pre-paint regardless, since they're driven by the DOM attribute directly
 * via CSS, not by this React state).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(subscribeToThemeAttribute, getThemeSnapshot, () => 'light' as Theme)

  function toggleTheme() {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider (src/app/layout.tsx)')
  return ctx
}
