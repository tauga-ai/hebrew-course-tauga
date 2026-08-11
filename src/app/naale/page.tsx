'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { createClient } from '@/lib/supabase/client'
import { t } from '@/lib/dev-i18n'

/**
 * Routing shim: resolves the caller's role via /api/naale/me and sends them
 * to the right place. Staff and not-on-roster forward elsewhere; a student
 * just stays here for now — the real student home lands in ticket 9.
 */
export default function NaalePage() {
  const router = useRouter()
  const [role, setRole] = useState<'student' | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      const res = await fetch('/api/naale/me')
      if (cancelled) return

      if (res.status === 401) {
        router.replace('/naale/login')
        return
      }
      if (res.status === 403) {
        router.replace('/naale/not-authorized')
        return
      }

      const data = await res.json()
      if (cancelled) return

      if (data.role === 'staff') {
        router.replace('/naale/staff')
        return
      }
      setRole('student')
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [router])

  if (!role) return <LoadingSpinner />

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/naale/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-fg/70 mb-6">{t('בקרוב...')}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-fg/40 hover:text-fg/70"
        >
          {t('יציאה')}
        </button>
      </div>
    </div>
  )
}
