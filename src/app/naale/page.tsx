'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { CardGrid } from '@/components/ui/CardGrid'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleShell } from '@/components/naale/NaaleShell'
import { StartSessionSheet } from '@/components/naale/StartSessionSheet'
import { ResumeSessionSheet } from '@/components/naale/ResumeSessionSheet'
import { nextSessionKind } from '@/lib/naale/next-session-kind'
import type { NaaleTopicStat } from '@/lib/naale/stats'
import { primeNaaleProfile } from '@/lib/naale/use-naale-profile'
import { t } from '@/lib/dev-i18n'

interface NaaleMe {
  role: 'student' | 'staff'
  // translation_lang is already in /api/naale/me's response — the sheet needs
  // it to show which language is currently selected.
  student: { id: string; full_name: string; translation_lang?: 'ru' | 'ar' }
  avatar_url: string | null
  is_admin: boolean
}

interface MyStatsTotals {
  xp: number
  coins: number
  streak: number
}

// The real workbook's topics (naale-track-first-build/CONTEXT.md's data
// audit, 2026-08-10) — shown honestly as locked rather than hidden, since a
// student otherwise has no way to know these topics exist at all. Real
// content from the source spreadsheet, not invented placeholder text.
//
// This list is a FALLBACK, not the source of truth: it was written when none
// of these had rows in naale_questions, on the assumption that a topic with
// zero rows never reaches buildTopicStats()'s allTopics and so could never
// collide with a live card. Content has since been imported for all of them,
// and because nobody updated the array every one rendered TWICE — once live,
// once "coming soon". Hence lockedTopics below, which subtracts whatever the
// question bank actually serves instead of trusting this array to be current.
const LOCKED_TOPICS = ['נרדפות והופכיות', 'הבנת הנקרא', 'תיקון משפטים', 'סיפור בהמשכים', 'ווטסאפ והודעות', 'סיכום טקסט קצר']

// One emoji per topic, so the card grid can be scanned by shape rather than
// by reading nine similar lines of Hebrew. Deliberately picked to be visually
// distinct from each other — the whole point is telling cards apart at a
// glance, so no two paper/pencil glyphs. Keyed by the topic's exact name as
// it comes from the question bank; TOPIC_EMOJI_FALLBACK covers any topic
// imported later that isn't listed here yet.
const TOPIC_EMOJI: Record<string, string> = {
  'השלמת משפטים': '✍️',      // sentence completion
  'הבנת הנקרא': '📖',        // reading comprehension
  'נרדפות והופכיות': '🔀',   // synonyms & antonyms
  'תיקון משפטים': '🔧',      // sentence correction
  'סיפור בהמשכים': '📚',     // story continuation
  'ווטסאפ והודעות': '💬',    // WhatsApp & messages
  'סיכום טקסט קצר': '📋',    // short text summary
  'תיאור תמונה בקול': '🖼️',  // spoken picture description
}
const TOPIC_EMOJI_FALLBACK = '📄'

/**
 * The Naale student home — a desktop-aware shell (NaaleSidebar + max-w-5xl
 * content area) per Ticket 17, with a card-based dashboard layout (stat
 * tiles, practice/progress action cards, per-topic card grid) below it.
 */
export default function NaaleHome() {
  const router = useRouter()
  const [me, setMe] = useState<NaaleMe | null>(null)
  const [rewards, setRewards] = useState<MyStatsTotals | null>(null)
  const [topics, setTopics] = useState<NaaleTopicStat[] | null>(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  // null: the sheet is for the mixed 30-minute session (handleStart). A
  // topic name: the sheet is for that topic's 5-minute session instead
  // (naale-topic-based-sessions) — same sheet, same confirm-before-clock-starts
  // job, just a different destination once confirmed.
  const [sheetTopic, setSheetTopic] = useState<string | null>(null)
  // Set only when session/start reports an unfinished topic session instead of
  // starting one. Null on the normal path, so a student with nothing pending
  // never sees an extra step (naale-topic-session-resume). `origin` distinguishes
  // which button produced this offer, since resumable.topic is always the PAUSED
  // topic's name either way and can't tell them apart on its own — it decides
  // what "Start Over" should actually start (naale-practice-button-resumable-crash).
  const [resumable, setResumable] = useState<
    { session_id: string; topic: string | null; seconds_remaining: number; answered_count: number; origin: 'topic' | 'practice' } | null
  >(null)
  // Which topic (if any) has a paused session right now, for the "in
  // progress · Xm left" badge on that one card (naale-topic-card-resume-badge).
  // Best-effort like the rewards fetch below — a failed/empty read just means
  // no badge shows, never a blocked dashboard.
  const [pausedTopic, setPausedTopic] = useState<
    { topic: string; seconds_remaining: number; total_seconds: number } | null
  >(null)
  // The element that opened the sheet, so keyboard focus returns to it —
  // whichever one that was, the main tile or a specific topic card.
  const startTileRef = useRef<HTMLButtonElement>(null)
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/naale/me')
      if (cancelled) return
      if (res.status === 401) { router.replace('/naale/login'); return }
      if (res.status === 403) {
        // Not on the roster — but login always lands here regardless of
        // role, so a Naale admin with no roster/students row (an account
        // that manages content but never takes the practice track) would
        // otherwise have no way to reach /naale/admin after signing in.
        // Check admin status as a fallback before giving up.
        const adminRes = await fetch('/api/naale/admin/me')
        if (cancelled) return
        if (adminRes.ok) { router.replace('/naale/admin'); return }
        router.replace('/naale/not-authorized')
        return
      }
      if (!res.ok) { setError('שגיאה בטעינת הפרופיל. בדוק חיבור לאינטרנט ונסה שוב.'); return }
      const data: NaaleMe = await res.json()
      if (cancelled) return
      // Staff get their own view — the email decided this, not a picker.
      if (data.role === 'staff') { router.replace('/naale/staff'); return }
      setMe(data)
      // NaaleSidebar (rendered below via NaaleShell) reads the same profile
      // — priming here means it reuses this fetch instead of firing its own.
      primeNaaleProfile('student', {
        full_name: data.student.full_name,
        avatar_url: data.avatar_url,
        translation_lang: data.student.translation_lang,
        is_admin: data.is_admin,
      })

      // Best-effort: a failed rewards/badge fetch shouldn't block the home
      // screen itself from rendering, so each is just omitted on failure
      // rather than surfaced as a page-blocking error. Fired together via
      // Promise.all rather than one after another — sequential awaits meant
      // the paused-topic badge/ring always arrived a full round trip after
      // the topic grid itself, popping in visibly late instead of rendering
      // with it.
      const [statsRes, pausedRes] = await Promise.all([
        fetch('/api/naale/my-stats'),
        fetch('/api/naale/session/paused-topic'),
      ])
      if (cancelled) return

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        if (!cancelled) {
          setRewards(statsData.totals)
          setTopics(statsData.topics)
        }
      }

      if (!cancelled && pausedRes.ok) {
        const pausedData = await pausedRes.json()
        if (!cancelled) setPausedTopic(pausedData.topic ? pausedData : null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [router])

  /**
   * Called from the sheet's Start button, never straight from the tile:
   * /api/naale/session/start creates the session row and stamps deadline_at,
   * so calling it before the student has read the terms would run the clock
   * while they read.
   */
  async function handleStart() {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/naale/session/start', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      // A topic session left paused answers even a plain Practice tap with an
      // offer to resume it instead (session/start, naale-topic-scoped-session-
      // resume's deliberate `requestedTopic: null` behavior) — previously
      // unhandled here, so `data.session_id` was undefined and this crashed
      // (naale-practice-button-resumable-crash). Mirrors handleStartTopicSession's
      // existing handling below — including closing the StartSessionSheet this
      // was called from, or it stays stacked underneath the resume prompt.
      if (data.resumable) {
        setResumable({ ...data.resumable, origin: 'practice' })
        setSheetOpen(false)
        setStarting(false)
        return
      }
      const destination = data.kind === 'placement' ? '/naale/placement' : '/naale/session'
      router.push(`${destination}?session_id=${data.session_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בפתיחת תרגול')
      setStarting(false)
    }
  }

  function closeSheet() {
    setSheetOpen(false)
    setError('')
    setSheetTopic(null)
    ;(lastTriggerRef.current ?? startTileRef.current)?.focus()
  }

  function openTopicSheet(topic: string, e: MouseEvent<HTMLButtonElement>) {
    lastTriggerRef.current = e.currentTarget
    setSheetTopic(topic)
    setSheetOpen(true)
  }

  /**
   * Starts a 5-minute session scoped to one topic (naale-topic-based-sessions),
   * called from the (shared) sheet's Start button once the student has
   * confirmed — same reasoning as handleStart() above for why this isn't
   * called straight from the topic card.
   */
  async function handleStartTopicSession(topic: string) {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/naale/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      // An unfinished topic session comes back as an offer rather than a
      // session (naale-topic-session-resume) — Noam: a returning student
      // "shouldn't be forced to finish that old session". The sheet closes and
      // the choice takes its place; nothing has been started yet at this point.
      if (data.resumable) {
        setResumable({ ...data.resumable, origin: 'topic' })
        setSheetOpen(false)
        setSheetTopic(null)
        setStarting(false)
        return
      }
      router.push(`/naale/session?session_id=${data.session_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בפתיחת תרגול')
      setStarting(false)
    }
  }

  /** Answers the returning-student prompt. 'resume' picks the old session back
   *  up with its banked time; 'start_over' abandons it and begins a fresh five
   *  minutes on the same topic. Answers already given survive either way —
   *  they live in naale_answers, which neither branch touches. */
  async function answerResumable(action: 'resume' | 'start_over') {
    if (!resumable) return

    // Resume navigates straight there and lets the session page restart the
    // clock once it has a question on screen. Un-pausing from HERE would start
    // the timer and then spend the next few seconds on a navigation, a /status
    // and a /next before the student could answer anything — billed to time
    // they had banked. It also drops a whole round trip out of the path
    // between tapping Continue and seeing a question.
    if (action === 'resume') {
      setStarting(true)
      // resumed=1 tells the session page the student already confirmed
      // resuming right here — it should restart the clock itself once a
      // question is on screen (same as before naale-explicit-pause-resume),
      // not show its own PausedSessionSheet on top of the choice just made.
      router.push(`/naale/session?session_id=${resumable.session_id}&resumed=1`)
      return
    }

    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/naale/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Only echo the paused topic back when THIS resumable came from that
        // topic's own tile — Start Over there means "restart this topic." From
        // the plain Practice button it means "start the normal 30-minute session
        // instead," so topic is omitted entirely (JSON.stringify drops an
        // `undefined` value), letting session/start fall through to its usual
        // kind-selection logic exactly as a fresh Practice tap would
        // (naale-practice-button-resumable-crash).
        body: JSON.stringify({ action, topic: resumable.origin === 'topic' ? resumable.topic : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      router.push(`/naale/session?session_id=${data.session_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בפתיחת תרגול')
      setStarting(false)
    }
  }

  // Shared with the staff self-practice button — see nextSessionKind().
  const nextKind = nextSessionKind(topics)

  // Only show a topic as "coming soon" if the question bank isn't already
  // serving it — see LOCKED_TOPICS. Skipped entirely while topics is still
  // null (mid-fetch), otherwise every locked card flashes on screen for a
  // beat and then vanishes as the live list arrives.
  const lockedTopics = topics
    ? LOCKED_TOPICS.filter(name => !topics.some(topic => topic.topic === name))
    : []

  if (error && !me) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4 text-center">
        <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>
        <button onClick={() => location.reload()} className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 hover:bg-black/5 dark:hover:bg-white/5">
          {t('נסה שוב')}
        </button>
      </div>
    )
  }

  if (!me) return <LoadingSpinner />

  return (
    <NaaleShell role="student" showAdminLink={me.is_admin}>
      <div className="mt-4 mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-fg">{t('שלום')}, {me.student.full_name}</h1>
          <p className="text-sm text-fg/60">{t('נעלה')}</p>
        </div>
      </div>

        {rewards ? (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 text-center">
              <div className="text-2xl">🔥</div>
              <div className="text-2xl font-bold text-fg mt-1"><LtrIsolate>{String(rewards.streak)}</LtrIsolate></div>
              <div className="text-xs text-fg/50 mt-0.5">{t('שבועות ברצף')}</div>
            </div>
            <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 text-center">
              <div className="text-2xl">⭐</div>
              <div className="text-2xl font-bold text-accent-naale mt-1"><LtrIsolate>{String(rewards.xp)}</LtrIsolate></div>
              <div className="text-xs text-fg/50 mt-0.5">{t('נקודות XP')}</div>
            </div>
            <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 text-center">
              <div className="text-2xl">🪙</div>
              <div className="text-2xl font-bold text-fg mt-1"><LtrIsolate>{String(rewards.coins)}</LtrIsolate></div>
              <div className="text-xs text-fg/50 mt-0.5">{t('מטבעות')}</div>
            </div>
          </div>
        ) : (
          // Matches NaaleSidebar's profile-row skeleton (same animate-pulse +
          // bg-gray-200/white-10 placeholder convention) — /api/naale/my-stats
          // is fetched only after /api/naale/me resolves, so without this the
          // row was simply absent for a beat, then popped in abruptly.
          <div className="grid grid-cols-3 gap-3 mb-6 animate-pulse">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 text-center">
                <div className="h-6 w-6 mx-auto rounded-full bg-gray-200 dark:bg-white/10" />
                <div className="h-6 w-10 mx-auto rounded bg-gray-200 dark:bg-white/10 mt-2" />
                <div className="h-2.5 w-16 mx-auto rounded bg-gray-200 dark:bg-white/10 mt-2" />
              </div>
            ))}
          </div>
        )}

        {/* The @container is load-bearing, not decoration: @[480px] measures
            the nearest container ancestor, and without one these two cards
            silently stayed at grid-cols-1 at every width. CardGrid below
            declares its own, which is why the topic grid was unaffected. */}
        <div className="@container mb-6">
        <div className="grid grid-cols-1 @[480px]:grid-cols-2 gap-3">
          <button
            type="button"
            ref={startTileRef}
            onClick={() => { lastTriggerRef.current = null; setSheetTopic(null); setSheetOpen(true) }}
            className="bg-accent-naale rounded-2xl p-5 text-right transition hover:brightness-110 flex flex-col gap-6"
          >
            {/* justify-between rather than explicit sides: the icon sits on
                the reading-start edge and the arrow on the reading-end edge
                in both RTL Hebrew and the LTR dev-English toggle. */}
            <span className="flex items-start justify-between">
              <span className="w-11 h-11 rounded-full flex items-center justify-center text-xl bg-white/20">▶️</span>
              <span className="text-white/70">←</span>
            </span>
            <span className="block">
              <span className="block font-extrabold text-white text-xl">{t('תרגול')}</span>
              <span className="block text-xs text-white/70 mt-0.5">{t('30 דקות')}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/naale/stats')}
            className="bg-surface border border-card-border rounded-2xl p-5 text-right transition hover:shadow-sm hover:border-accent-naale flex flex-col gap-6"
          >
            <span className="flex items-start justify-between">
              <span className="w-11 h-11 rounded-full flex items-center justify-center text-xl border border-accent-naale/30 bg-accent-naale/10">📊</span>
              <span className="text-fg/30">←</span>
            </span>
            <span className="block">
              <span className="block font-extrabold text-fg text-xl">{t('ההתקדמות שלי')}</span>
            </span>
          </button>
        </div>
        </div>

        {/* The per-topic level readout this section used to carry moved to
            /naale/stats, where the same numbers already lived — Noam's call
            (naale-topic-based-sessions). The link keeps that one tap away
            rather than leaving the levels with no route from here. */}
        <div className="mt-6 mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-fg/70">{t('תרגל לפי נושא')}</h2>
          {/* min-h + inline-flex rather than padding: the hit area grows to
              44px around the label without the label itself moving, and the
              negative margin keeps the text optically aligned with the
              section edge despite the added horizontal padding. Measured at
              48x16 in the mobile QA pass — the smallest control in the app. */}
          <button
            type="button"
            onClick={() => router.push('/naale/stats')}
            className="inline-flex items-center min-h-[44px] px-3 -me-3 text-xs font-medium text-accent-naale hover:underline shrink-0"
          >
            {t('כל הרמות')}
          </button>
        </div>
        <CardGrid cols={4}>
          {/* Same animate-pulse placeholder convention as the stat tiles
              above and NaaleSidebar's profile row. Eight cards because that's
              what the question bank currently serves — the exact count only
              has to stop the grid collapsing to nothing and then reflowing,
              and min-h matches a real card so the page doesn't jump when the
              real ones arrive. */}
          {topics === null &&
            Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 flex flex-col justify-between gap-6 min-h-[7.5rem] animate-pulse"
              >
                <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-white/10" />
                <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-white/10" />
              </div>
            ))}
          {topics?.map(topic => (
            <button
              key={topic.topic}
              type="button"
              disabled={starting}
              onClick={e => openTopicSheet(topic.topic, e)}
              className={`bg-surface rounded-2xl shadow-sm border p-4 text-right transition hover:shadow-sm disabled:opacity-60 flex flex-col justify-between gap-6 min-h-[7.5rem]${
                pausedTopic?.topic === topic.topic
                  ? ' border-accent-naale/50 ring-2 ring-accent-naale/20'
                  : ' border-card-border hover:border-accent-naale'
              }`}
            >
              {/* Levels are gone from this card, so a dimmed icon is the only
                  thing left distinguishing a topic the student has never
                  opened from one they've answered 200 questions in. */}
              <span
                className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl border border-accent-naale/30 bg-accent-naale/10${
                  topic.started ? '' : ' opacity-40'
                }`}
              >
                {TOPIC_EMOJI[topic.topic] ?? TOPIC_EMOJI_FALLBACK}
              </span>
              <span className="block">
                <span className="block text-sm font-semibold text-fg/80 line-clamp-2">{t(topic.topic)}</span>
                {/* Only ever the one card matching pausedTopic — every other
                    card is unchanged (naale-topic-card-resume-badge). Reads
                    as part of the card's own description rather than a
                    floating badge, and shows time left AGAINST the 5-minute
                    max (not a bare countdown) so the bar's fill has a fraction
                    to actually represent. mm:ss matches the clock format
                    ResumeSessionSheet already uses for the same value. */}
                {pausedTopic?.topic === topic.topic && (
                  <span className="block mt-1">
                    <span className="block text-[11px] font-medium text-accent-naale">
                      <LtrIsolate>
                        {t('בעיצומו')} · {Math.floor(pausedTopic.seconds_remaining / 60)}:{String(pausedTopic.seconds_remaining % 60).padStart(2, '0')}{' '}
                        {t('מתוך')} {Math.floor(pausedTopic.total_seconds / 60)}:{String(pausedTopic.total_seconds % 60).padStart(2, '0')}
                      </LtrIsolate>
                    </span>
                    <span className="block mt-1.5 h-1 rounded-full bg-card-border overflow-hidden">
                      <span
                        className="block h-full rounded-full bg-accent-naale"
                        style={{ width: `${Math.min(100, (pausedTopic.seconds_remaining / pausedTopic.total_seconds) * 100)}%` }}
                      />
                    </span>
                  </span>
                )}
              </span>
            </button>
          ))}
          {lockedTopics.map(name => (
            // Dashed border instead of a blanket opacity-50: dimming the whole
            // card took the label down with it and left the topic name barely
            // readable, which defeats the point of showing locked topics at all.
            <div
              key={name}
              className="bg-surface/50 rounded-2xl border border-dashed border-card-border p-4 flex flex-col justify-between gap-6 min-h-[7.5rem]"
            >
              <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl border border-card-border bg-fg/5 opacity-40">
                🔒
              </span>
              <span className="block">
                <span className="block text-sm font-semibold text-fg/40 line-clamp-2">{t(name)}</span>
                <span className="block text-xs text-fg/30 mt-0.5">{t('בקרוב...')}</span>
              </span>
            </div>
          ))}
        </CardGrid>

      {error && !sheetOpen && (
        <p className="text-red-500 dark:text-red-400 text-sm mt-4 text-center">{error}</p>
      )}

      {/* The returning-student choice (naale-topic-session-resume). Same
          bottom-sheet-on-phone / centred-dialog-on-web treatment as
          StartSessionSheet rather than a second modal pattern, but a separate
          component: that sheet's job is "here are the terms, begin", and this
          one's is "you left something unfinished" — folding two different
          questions into one component would make both harder to read. */}
      {resumable && (
        <ResumeSessionSheet
          topicName={resumable.topic}
          secondsRemaining={resumable.seconds_remaining}
          answeredCount={resumable.answered_count}
          starting={starting}
          error={error}
          onResume={() => answerResumable('resume')}
          onStartOver={() => answerResumable('start_over')}
          onClose={() => { setResumable(null); setError(''); (lastTriggerRef.current ?? startTileRef.current)?.focus() }}
        />
      )}

      {sheetOpen && (
        <StartSessionSheet
          kind={sheetTopic ? 'topic' : nextKind}
          topicName={sheetTopic ?? undefined}
          conflictingPausedTopic={
            sheetTopic && pausedTopic?.topic && pausedTopic.topic !== sheetTopic ? pausedTopic.topic : null
          }
          lang={me.student.translation_lang ?? 'ru'}
          starting={starting}
          error={error}
          onStart={() => (sheetTopic ? handleStartTopicSession(sheetTopic) : handleStart())}
          onClose={closeSheet}
        />
      )}
    </NaaleShell>
  )
}
