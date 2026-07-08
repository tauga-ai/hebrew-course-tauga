'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const LANGUAGES = ['ערבית', 'רוסית'] as const

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
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-primary-400 mb-2">כמעט סיימנו</h1>
        <p className="text-center text-fg/60 mb-8 text-sm">רק עוד שני פרטים לפני שמתחילים</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-fg/80 mb-1">
              שם מלא בעברית, כפי שהמורה מכיר/ה אותך
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full border border-card-border rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-primary-500 bg-surface text-fg"
              placeholder="שם מלא"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-fg/80 mb-1">באיזו שפה את/ה לומד/ת?</label>
            <div className="grid grid-cols-2 gap-3">
              {LANGUAGES.map(lang => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setClassCode(lang)}
                  className={`py-2.5 rounded-lg font-semibold border transition ${
                    classCode === lang
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-surface text-fg/80 border-card-border hover:border-primary-400'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !classCode}
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
