'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/dev-i18n'

interface NaaleMe {
  role: 'student' | 'staff'
  student: { id: string; full_name: string }
}

/**
 * The Naale student home. Deliberately just two destinations — per the product
 * owner, this track's first build is "a session and a profile with stats", and
 * it inherits none of the draft-prep menu's activities (/menu is untouched).
 *
 * No StudentSidebar: that component's nav is hardcoded to draft-prep routes,
 * and with two destinations there's nothing to navigate.
 */
export default function NaaleHome() {
  const router = useRouter()
  const [me, setMe] = useState<NaaleMe | null>(null)
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
      router.push(`/naale/session?session_id=${data.session_id}`)
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
    <div className="min-h-screen p-4 max-w-md mx-auto w-full">
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

      {error && <p className="text-red-500 dark:text-red-400 text-sm mt-4 text-center">{error}</p>}
    </div>
  )
}
