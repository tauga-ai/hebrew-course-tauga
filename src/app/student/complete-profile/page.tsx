'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/LoadingSpinner'

// Forced destination for an authenticated user with no `students` row yet —
// mainly first-time Google sign-ins, which have no class/full_name.
function CompleteProfileForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [fullName, setFullName] = useState('')
  const [classCode, setClassCode] = useState(searchParams.get('class_code') || '')
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/student')
        return
      }

      const res = await fetch('/api/student/profile')
      if (res.ok) {
        // Already has a profile — nothing to complete here.
        router.replace('/menu')
        return
      }

      // Pre-fill from the Google identity if available, but it stays
      // editable/required — the teacher needs the student's Hebrew name.
      const googleName = (user.user_metadata?.full_name || user.user_metadata?.name || '') as string
      setFullName(googleName)
      setChecking(false)
    }
    check()
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !classCode.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), class_code: classCode.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      router.push('/menu')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת הפרופיל')
    } finally {
      setLoading(false)
    }
  }

  if (checking) return <LoadingSpinner />

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-primary-700 mb-2">כמעט סיימנו</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">רק עוד שני פרטים לפני שמתחילים</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
              שם מלא בעברית — כפי שהמורה מכיר/ה אותך
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="שם מלא"
              required
            />
          </div>

          <div>
            <label htmlFor="classCode" className="block text-sm font-medium text-gray-700 mb-1">קוד כיתה</label>
            <input
              id="classCode"
              type="text"
              value={classCode}
              onChange={e => setClassCode(e.target.value.toUpperCase())}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="קוד שקיבלת מהמורה"
              required
            />
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white font-semibold py-2.5 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? 'שומר/ת...' : 'המשך'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function CompleteProfilePage() {
  return (
    <Suspense>
      <CompleteProfileForm />
    </Suspense>
  )
}
