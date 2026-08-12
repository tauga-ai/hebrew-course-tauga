'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { getDevLang, setDevLang, subscribeDevLang } from '@/lib/dev-i18n'
import { getShowHint, setShowHint, subscribeShowHint } from '@/lib/dev-hint'

/**
 * Dev-only. Renders only because layout.tsx wraps this in {isDev && ...}.
 * Replaces the old DevLangToggle's direct-toggle button with a floating
 * button that opens a sheet, so more than one dev QA tool (language/RTL,
 * answer hints) can live behind one button instead of stacking several.
 * Lives outside DevLangProvider's remount boundary so the button itself
 * never disappears mid-toggle.
 */
export function DevPanel() {
  const lang = useSyncExternalStore(subscribeDevLang, getDevLang, getDevLang)
  const showHint = useSyncExternalStore(subscribeShowHint, getShowHint, getShowHint)
  const [open, setOpen] = useState(false)

  // DevLangProvider restores dev-lang's cookie on mount itself (it needs to,
  // for the remount-key trick). The hint toggle has no such provider, so it
  // restores its own persisted value here instead.
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )dev-hint=(0|1)/)
    if (match) setShowHint(match[1] === '1')
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-4 z-50 rounded-full bg-gray-800 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-gray-700 ${lang === 'he' ? 'left-4' : 'right-4'}`}
      >
        {lang === 'he' ? 'EN' : 'עב'}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-surface border border-card-border rounded-t-2xl p-4 shadow-lg mb-0"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-fg">Dev QA tools</span>
              <button type="button" onClick={() => setOpen(false)} className="text-fg/40 hover:text-fg/70 text-sm px-2">
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-card-border">
              <span className="text-sm text-fg">Language / RTL</span>
              <button
                type="button"
                onClick={() => setDevLang(lang === 'he' ? 'en' : 'he')}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-gray-800 text-white hover:bg-gray-700"
              >
                {lang === 'he' ? 'Switch to EN' : 'Switch to HE'}
              </button>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-card-border">
              <div>
                <div className="text-sm text-fg">Show answer hints</div>
                <div className="text-xs text-fg/50">Naale session questions only</div>
              </div>
              <button
                type="button"
                onClick={() => setShowHint(!showHint)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full ${
                  showHint ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-white/10 text-fg/70'
                }`}
              >
                {showHint ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
