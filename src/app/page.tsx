'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      // /menu's session hook redirects further to /student/complete-profile
      // if this user has no `students` row yet — no need to check here.
      router.replace(user ? '/menu' : '/student')
    }
    check()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-gray-500 text-lg">טוען...</div>
    </div>
  )
}
