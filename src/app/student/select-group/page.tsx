'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { LoadingSpinner } from '@/components/LoadingSpinner'

const GROUPS = [1, 2, 3] as const

// Forced destination for a student whose class requires a lesson group
// (currently only the Arabic-speaking class) and hasn't picked one yet.
export default function SelectGroupPage() {
  const router = useRouter()
  const { session, loading } = useStudentSession('/student', { skipGroupGate: true })
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState('')

  async function choose(group: number) {
    setSaving(group)
    setError('')
    try {
      const res = await fetch('/api/student/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lesson_group: group }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      router.push('/menu')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הכיתה')
      setSaving(null)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-primary-700 dark:text-primary-400 mb-2">איזו כיתה?</h1>
        <p className="text-center text-fg/60 mb-8 text-sm">
          {session?.full_name} · {session?.class_name}
          <br />
          תבחר/י את הכיתה שהמורה הכריז/ה עליה עכשיו בשיעור
        </p>

        <div className="grid grid-cols-3 gap-3">
          {GROUPS.map(group => (
            <button
              key={group}
              onClick={() => choose(group)}
              disabled={saving !== null}
              className="bg-primary-600 text-white font-bold text-xl py-6 rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {saving === group ? '...' : `כיתה ${group}`}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mt-4">{error}</p>}
      </div>
    </div>
  )
}
