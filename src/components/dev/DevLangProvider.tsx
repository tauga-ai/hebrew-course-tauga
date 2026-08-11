'use client'

import { Fragment, useLayoutEffect, useState, type ReactNode } from 'react'
import { getDevLang, setDevLang, subscribeDevLang, type DevLang } from '@/lib/dev-i18n'

/**
 * Dev-only. Remounts `children` under a fresh `key` whenever the toggle
 * changes, so every t() call inside re-executes with the new language —
 * t() itself is a plain function, so nothing else would cause already
 * -mounted components to pick up the change. Runs in useLayoutEffect (before
 * paint, after hydration) so this never factors into hydration comparison;
 * see dev-i18n.ts's doc comment for why that ordering matters.
 */
export function DevLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<DevLang>(getDevLang())

  useLayoutEffect(() => {
    const match = document.cookie.match(/(?:^|; )dev-lang=(he|en)/)
    if (match) setDevLang(match[1] as DevLang)
    return subscribeDevLang(() => setLang(getDevLang()))
  }, [])

  return <Fragment key={lang}>{children}</Fragment>
}
