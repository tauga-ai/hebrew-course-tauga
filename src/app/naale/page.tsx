'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { CardGrid } from '@/components/ui/CardGrid'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { LevelSteps } from '@/components/naale/LevelSteps'
import type { NaaleTopicStat } from '@/lib/naale/stats'
import { t } from '@/lib/dev-i18n'

interface NaaleMe {
  role: 'student' | 'staff'
  student: { id: string; full_name: string }
}

interface MyStatsTotals {
  xp: number
  coins: number
  streak: number
}

// The real workbook's 6 not-yet-imported topics (naale-track-first-build/
// CONTEXT.md's data audit, 2026-08-10) — shown honestly as locked rather
// than hidden, since a student otherwise has no way to know 7 topics exist
// at all. Static, not DB-sourced: naale_questions has no rows for these yet
// (buildTopicStats()'s allTopics comes from the question bank, so a topic
// with zero rows simply never appears there), and this list is real content
// from the source spreadsheet, not invented placeholder text.
const LOCKED_TOPICS = ['נרדפות והופכיות', 'הבנת הנקרא', 'תיקון משפטים', 'סיפור בהמשכים', 'ווטסאפ והודעות', 'סיכום טקסט קצר']

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

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/naale/me')
      if (cancelled) return
      if (res.status === 401) { router.replace('/naale/login'); return }
      if (res.status === 403) { router.replace('/naale/not-authorized'); return }
      if (!res.ok) { setError('שגיאה בטעינת הפרופיל. בדוק חיבור לאינטרנט ונסה שוב.'); return }
      const data: NaaleMe = await res.json()
      if (cancelled) return
      // Staff get their own view — the email decided this, not a picker.
      if (data.role === 'staff') { router.replace('/naale/staff'); return }
      setMe(data)

      // Best-effort: a failed rewards fetch shouldn't block the home screen
      // itself from rendering, so it's fetched separately and just omitted
      // (streak/xp/coins badge simply doesn't show) rather than surfaced as
      // a page-blocking error.
      const statsRes = await fetch('/api/naale/my-stats')
      if (cancelled || !statsRes.ok) return
      const statsData = await statsRes.json()
      if (cancelled) return
      setRewards(statsData.totals)
      setTopics(statsData.topics)
    }
    load()
    return () => { cancelled = true }
  }, [router])

  async function handleStart() {
    setStarting(true)
    setError('')
    try {
      const res = await fetch('/api/naale/session/start', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      const destination = data.kind === 'placement' ? '/naale/placement' : '/naale/session'
      router.push(`${destination}?session_id=${data.session_id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בפתיחת תרגול')
      setStarting(false)
    }
  }

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
    <div className="min-h-screen md:flex">
      <NaaleSidebar role="student" />
      <div className="flex-1 p-4 max-w-5xl mx-auto w-full">
        <div className="mt-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-fg">{t('שלום')}, {me.student.full_name}</h1>
            <p className="text-sm text-fg/60">{t('נעלה')}</p>
          </div>
        </div>

        {rewards && (
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
        )}

        <div className="grid grid-cols-1 @[480px]:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={handleStart}
            disabled={starting}
            className="bg-surface border border-card-border rounded-2xl p-5 flex items-center gap-4 text-right transition hover:shadow-sm hover:border-accent-naale disabled:cursor-default"
          >
            <span className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl border border-accent-naale/30 bg-accent-naale/10 text-accent-naale">▶️</span>
            <span className="flex-1 min-w-0">
              <span className="block font-extrabold text-fg text-xl">{t('תרגול')}</span>
              <span className="block text-xs text-accent-naale mt-0.5">{t('30 דקות')}</span>
            </span>
            <span className="text-fg/30 shrink-0">←</span>
          </button>
          <button
            type="button"
            onClick={() => router.push('/naale/stats')}
            className="bg-surface border border-card-border rounded-2xl p-5 flex items-center gap-4 text-right transition hover:shadow-sm hover:border-accent-naale"
          >
            <span className="shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-2xl border border-accent-naale/30 bg-accent-naale/10 text-accent-naale">📊</span>
            <span className="flex-1 min-w-0">
              <span className="block font-extrabold text-fg text-xl">{t('ההתקדמות שלי')}</span>
            </span>
            <span className="text-fg/30 shrink-0">←</span>
          </button>
        </div>

        <h2 className="text-sm font-semibold text-fg/70 mt-6 mb-2">{t('רמות לפי נושא')}</h2>
        <CardGrid>
          {topics?.map(topic => (
            <div key={topic.topic} className="bg-surface rounded-2xl shadow-sm border border-card-border p-4">
              <div className="text-sm text-fg/80 truncate mb-2">{topic.topic}</div>
              {topic.started ? (
                <div className="flex items-center gap-2">
                  <LevelSteps level={topic.level ?? 1} />
                  <span className="text-xs text-fg/50">
                    {t('רמה')} <LtrIsolate>{String(topic.level ?? 1)}</LtrIsolate>
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <LevelSteps level={0} />
                  <span className="text-xs text-fg/30">{t('לא התחיל')}</span>
                </div>
              )}
            </div>
          ))}
          {LOCKED_TOPICS.map(name => (
            <div key={name} className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 opacity-50">
              <div className="text-sm text-fg/80 truncate mb-2">{name}</div>
              <div className="flex items-center gap-2">
                <LevelSteps level={0} locked />
                <span className="text-xs text-fg/40">🔒 {t('בקרוב...')}</span>
              </div>
            </div>
          ))}
        </CardGrid>

        {error && <p className="text-red-500 dark:text-red-400 text-sm mt-4 text-center">{error}</p>}
      </div>
    </div>
  )
}
