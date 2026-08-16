'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { NaaleSidebar } from '@/components/naale/NaaleSidebar'
import { LevelSteps } from '@/components/naale/LevelSteps'
import { createClient } from '@/lib/supabase/client'
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
 * The Naale student home — now a desktop-aware shell (NaaleSidebar +
 * max-w-5xl content area) instead of a single centered mobile column, per
 * Ticket 17. The two-destination CardGrid is unchanged; the new addition is
 * the "levels by topic" section below it.
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

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/naale/login')
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
            <h1 className="text-xl font-bold text-fg">{t('שלום')}, {me.student.full_name}</h1>
            <p className="text-sm text-fg/60">{t('נעלה')}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-fg/40 hover:text-fg/70"
          >
            {t('יציאה')}
          </button>
        </div>

        {rewards && (
          <div className="flex items-center justify-between gap-2 mb-6 text-sm bg-surface rounded-xl border border-card-border px-4 py-2.5">
            <span className="flex items-center gap-1 text-fg/70">
              🔥 <LtrIsolate>{rewards.streak}</LtrIsolate> {t('שבועות ברצף')}
            </span>
            <span className="flex items-center gap-3 text-fg/70">
              <span>⭐ <LtrIsolate>{rewards.xp}</LtrIsolate></span>
              <span>🪙 <LtrIsolate>{rewards.coins}</LtrIsolate></span>
            </span>
          </div>
        )}

        <CardGrid>
          <Card
            icon="▶️"
            title={t('תרגול')}
            subtitle={t('30 דקות')}
            accentColor="naale"
            onClick={handleStart}
            disabled={starting}
          />
          <Card
            icon="📊"
            title={t('ההתקדמות שלי')}
            accentColor="naale"
            href="/naale/stats"
            onClick={() => router.push('/naale/stats')}
          />
        </CardGrid>

        <h2 className="text-sm font-semibold text-fg/70 mt-6 mb-2">{t('רמות לפי נושא')}</h2>
        <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-4 space-y-3">
          {topics?.map(topic => (
            <div key={topic.topic} className="flex items-center justify-between gap-3">
              <span className="text-sm text-fg/80 flex-1 min-w-0 truncate">{topic.topic}</span>
              {topic.started ? (
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-fg/50">
                    {t('רמה')} <LtrIsolate>{String(topic.level ?? 1)}</LtrIsolate>
                  </span>
                  <LevelSteps level={topic.level ?? 1} />
                </span>
              ) : (
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-fg/30">{t('לא התחיל')}</span>
                  <LevelSteps level={0} />
                </span>
              )}
            </div>
          ))}
          {LOCKED_TOPICS.map(name => (
            <div key={name} className="flex items-center justify-between gap-3 opacity-50">
              <span className="text-sm text-fg/80 flex-1 min-w-0 truncate">{name}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-fg/40">🔒 {t('בקרוב...')}</span>
                <LevelSteps level={0} locked />
              </span>
            </div>
          ))}
        </div>

        {error && <p className="text-red-500 dark:text-red-400 text-sm mt-4 text-center">{error}</p>}
      </div>
    </div>
  )
}
