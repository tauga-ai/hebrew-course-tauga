'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentSession } from '@/lib/types'

/**
 * Resolves the current student's session from /api/student/profile (backed
 * by the Supabase auth cookie, not localStorage). Redirects to `redirectTo`
 * when unauthenticated, or to /student/complete-profile when authenticated
 * but with no `students` row yet (first-time Google sign-ins mainly).
 * `loading` stays true until one of these resolves — callers must not act
 * on a null session while loading.
 */
export function useStudentSession(redirectTo = '/student') {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const res = await fetch('/api/student/profile')
      if (cancelled) return

      if (res.status === 401) {
        router.replace(redirectTo)
        return
      }
      if (res.status === 404) {
        router.replace('/student/complete-profile')
        return
      }

      const data: StudentSession = await res.json()
      if (cancelled) return
      setSession(data)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router, redirectTo])

  return { session, loading }
}
