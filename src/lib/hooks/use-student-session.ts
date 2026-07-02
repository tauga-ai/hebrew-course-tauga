'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentSession } from '@/lib/types'

/**
 * Resolves the current student's session from /api/student/profile (backed
 * by the Supabase auth cookie, not localStorage). Redirects to `redirectTo`
 * when unauthenticated, or to /student/complete-profile when authenticated
 * but with no `students` row yet (first-time Google sign-ins mainly).
 * `loading` stays true until one of these resolves — callers must not act
 * on a null session while loading. On a network failure (fetch throws, or a
 * non-401/404 error status) `loading` still resolves to false and `error` is
 * set, instead of hanging forever; call `retry()` to try again.
 */
export function useStudentSession(redirectTo = '/student') {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
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
        if (!res.ok) throw new Error(`profile fetch failed with status ${res.status}`)

        const data: StudentSession = await res.json()
        if (cancelled) return
        setSession(data)
        setLoading(false)
      } catch {
        if (cancelled) return
        setError('שגיאה בטעינת הפרופיל. בדוק חיבור לאינטרנט ונסה שוב.')
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [router, redirectTo, attempt])

  const retry = useCallback(() => setAttempt(a => a + 1), [])

  return { session, loading, error, retry }
}
