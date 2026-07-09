'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Checks the Supabase auth session on mount.
 * Redirects to '/teacher/login' when no authenticated user is found.
 * `loading` is true until the check has completed.
 */
export function useTeacherAuth() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        router.replace('/teacher/login')
        return
      }
      setEmail(user.email || '')
      setLoading(false)
    }
    check()
    return () => {
      cancelled = true
    }
  }, [router])

  return { email, loading }
}
