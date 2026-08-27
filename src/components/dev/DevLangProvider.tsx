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
    // Subscribe BEFORE restoring the cookie. setDevLang() notifies listeners
    // synchronously, so doing it first meant this component's own listener
    // did not exist yet to hear about the restore — `lang` stayed at the
    // value getDevLang() returned during render, and the children never
    // remounted. document.dir/lang were set correctly (setDevLang writes them
    // directly), so the page looked RTL while every t() string stayed
    // English until someone clicked the toggle by hand, which worked because
    // by then the listener was registered.
    //
    // Dev-only either way — t() returns the Hebrew string unchanged when
    // debugMode is false — but it made the mobile QA pass need a manual
    // toggle on every hard navigation.
    const unsubscribe = subscribeDevLang(() => setLang(getDevLang()))
    const match = document.cookie.match(/(?:^|; )dev-lang=(he|en)/)
    if (match) setDevLang(match[1] as DevLang)
    return unsubscribe
  }, [])

  return <Fragment key={lang}>{children}</Fragment>
}
