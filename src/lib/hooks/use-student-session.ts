'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentSession } from '@/lib/types'

const STORAGE_KEY = 'student_session'

/**
 * Reads the student session from localStorage on mount.
 * Redirects to `redirectTo` (default '/student') when no session is stored.
 * `loading` is true until the check has completed.
 */
export function useStudentSession(redirectTo = '/student') {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      router.replace(redirectTo)
      return
    }
    setSession(JSON.parse(raw))
    setLoading(false)
  }, [router, redirectTo])

  return { session, loading }
}
