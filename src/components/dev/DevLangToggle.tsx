'use client'

import { useSyncExternalStore } from 'react'
import { getDevLang, setDevLang, subscribeDevLang } from '@/lib/dev-i18n'

/**
 * Dev-only. Renders only because layout.tsx wraps this in {isDev && ...}.
 * Bottom-right in English/LTR, bottom-left in Hebrew/RTL. Lives outside
 * DevLangProvider's remount boundary so the button itself never disappears
 * mid-toggle.
 */
export function DevLangToggle() {
  const lang = useSyncExternalStore(subscribeDevLang, getDevLang, getDevLang)

  function toggle() {
    setDevLang(lang === 'he' ? 'en' : 'he')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`fixed bottom-4 z-50 rounded-full bg-gray-800 px-3 py-2 text-xs font-medium text-white shadow-lg hover:bg-gray-700 ${lang === 'he' ? 'left-4' : 'right-4'}`}
    >
      {lang === 'he' ? 'EN' : 'עב'}
    </button>
  )
}
