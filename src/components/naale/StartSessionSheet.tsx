'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { setTranslationLang, type TranslationLang } from '@/lib/naale/set-translation-lang'
import { t } from '@/lib/dev-i18n'

/**
 * The "before you start" surface: a bottom sheet on a phone, a centred dialog
 * from `sm:` up.
 *
 * It exists because three facts about a session were nowhere on screen — it
 * runs 30 minutes, leaving early means it does not count no matter how many
 * exercises were answered (isSessionCompleted requires the timer to elapse),
 * and completing it is worth 50 XP. A student could commit half an hour by
 * tapping a tile that only said "Practice".
 *
 * It also carries the translation-language choice, which until now lived as an
 * unlabelled flag at the bottom of the sidebar. This is the moment it matters:
 * the next thing the student does is hover words they don't know.
 *
 * Deliberately opens BEFORE /api/naale/session/start is called. That route
 * creates the session row and stamps deadline_at, so calling it first would
 * start the clock while the student is still reading the terms.
 *
 * The `open` flag drives BOTH directions of the transition: false on the first
 * paint so the entrance has somewhere to animate from, then false again while
 * closing so the exit is visible before the parent unmounts us. The parent
 * unmounts on onClose, which is why close() delays it by SHEET_MS.
 */
/** Kept in step with the duration classes below — the exit has to finish
 *  before the parent unmounts the sheet. */
const SHEET_MS = 220

export function StartSessionSheet({
  kind,
  topicName,
  lang,
  starting,
  error,
  onStart,
  onClose,
}: {
  /** Derived by the caller from whether any topic has a level yet — the same
   *  condition /api/naale/session/start uses to choose. 'topic' added by
   *  naale-topic-based-sessions — a 5-minute session scoped to one topic. */
  kind: 'practice' | 'placement' | 'topic'
  /** Required when kind === 'topic' — the topic this session will be scoped
   *  to, shown as the eyebrow label the same way 'placement' shows its own. */
  topicName?: string
  lang: TranslationLang
  starting: boolean
  error: string
  onStart: () => void
  onClose: () => void
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [chosen, setChosen] = useState<TranslationLang>(lang)
  const [langError, setLangError] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => { panelRef.current?.focus() }, [])

  // One frame at the closed position, then animate in.
  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 16)
    return () => clearTimeout(id)
  }, [])

  const close = useCallback(() => {
    if (starting) return
    setOpen(false)
    setTimeout(onClose, SHEET_MS)
  }, [onClose, starting])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  async function pick(next: TranslationLang) {
    if (next === chosen) return
    const previous = chosen
    setChosen(next)
    setLangError(false)
    const ok = await setTranslationLang(next)
    // Revert rather than leave the label disagreeing with what the server will
    // actually translate into.
    if (!ok) { setChosen(previous); setLangError(true) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      {/* Lighter than the app's other dialogs (bg-black/90) on purpose: the
          point of a sheet is that the screen you came from stays visible
          behind it, so this reads as a step rather than a page change. */}
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-session-title"
        tabIndex={-1}
        className={`relative w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-2xl shadow-xl px-5 pt-3 pb-6 sm:p-6 outline-none flex flex-col gap-4 transition-all duration-200 ease-out motion-reduce:transition-none ${
          open
            ? 'translate-y-0 opacity-100 sm:scale-100'
            : 'translate-y-full opacity-0 sm:translate-y-2 sm:scale-95'
        }`}
      >
        <span className="sm:hidden self-center w-10 h-1 rounded-full bg-card-border" aria-hidden />

        <div className="flex flex-col gap-1">
          {kind === 'placement' && (
            <span className="self-start text-[10px] font-bold tracking-wide uppercase text-accent-naale border border-accent-naale/30 bg-accent-naale/10 rounded-full px-2 py-0.5">
              {t('מבחן רמה')}
            </span>
          )}
          {/* Topic names ARE run through t() for display — reversing this
              slot's original "real content, leave unwrapped" call, which was
              made when the dashboard's cards were also unwrapped. They now
              translate too, and a card reading "Reading Comprehension" that
              opens a sheet labelled "הבנת הנקרא" is worse than either choice
              on its own. Display only: the prop itself stays the raw Hebrew,
              because it's the key onStart sends to session/start.
              Same eyebrow slot 'placement' uses above. */}
          {kind === 'topic' && topicName && (
            <span className="self-start text-[10px] font-bold tracking-wide uppercase text-accent-naale border border-accent-naale/30 bg-accent-naale/10 rounded-full px-2 py-0.5">
              {t(topicName)}
            </span>
          )}
          <h2 id="start-session-title" className="text-xl font-extrabold text-fg">
            {t(kind === 'placement' ? 'מתחילים במבחן רמה?' : kind === 'topic' ? 'מתחילים תרגול ממוקד?' : 'מתחילים תרגול?')}
          </h2>
        </div>

        {/* One line, because it has to survive being read every day. Placement
            gets its own: it is timed the same 30 minutes, but it writes
            completed:false, so it earns no completion XP — claiming 50 XP here
            would be a promise the app does not keep. Topic gets its own too:
            5 minutes, not 30, and deliberately doesn't count toward the streak
            or completed-session credit (naale-topic-based-sessions) — no XP
            claim here either, since promising a number this line doesn't
            control (per-question XP still applies, but stating an amount
            invites the same "the app doesn't keep this promise" risk 30
            was written to avoid). */}
        <p className="text-sm text-fg/65 leading-relaxed">
          {t(kind === 'placement'
            ? '30 דקות · המבחן קובע באיזו רמה תתחיל בכל נושא'
            : kind === 'topic'
              ? '5 דקות · שאלות מהנושא הזה בלבד'
              : '30 דקות · הישאר עד הסוף כדי שהתרגול ייחשב · 50 XP')}
        </p>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-fg/50">{t('תרגום')}</span>
          <div className="flex gap-2">
            <LangChip label={t('רוסית')} active={chosen === 'ru'} onClick={() => pick('ru')} />
            <LangChip label={t('ערבית')} active={chosen === 'ar'} onClick={() => pick('ar')} />
          </div>
        </div>

        {langError && (
          <p className="text-xs text-red-500 dark:text-red-400">{t('לא ניתן לשמור את שפת התרגום')}</p>
        )}
        {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}

        <button
          type="button"
          onClick={onStart}
          disabled={starting}
          className="w-full min-h-[52px] rounded-xl bg-accent-naale text-white text-base font-bold transition hover:opacity-90 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-naale"
        >
          {starting ? t('מתחיל תרגול...') : t('התחל')}
        </button>

        <button
          type="button"
          onClick={close}
          disabled={starting}
          className="w-full min-h-[44px] text-sm text-fg/50 hover:text-fg/70 transition disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-naale rounded-xl"
        >
          {t('לא עכשיו')}
        </button>
      </div>
    </div>
  )
}

function LangChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center min-h-[44px] text-xs px-4 rounded-full border transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-naale ${
        active
          ? 'bg-accent-naale border-accent-naale text-white font-bold'
          : 'bg-surface border-card-border text-fg/65 hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  )
}
