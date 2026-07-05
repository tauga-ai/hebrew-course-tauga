'use client'

import { useState } from 'react'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'

const GROUPS = [1, 2, 3] as const

export default function PersonalDetailsPage() {
  const { session, loading, retry } = useStudentSession()
  const [saving, setSaving] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [savedGroup, setSavedGroup] = useState<number | null>(null)

  async function changeGroup(group: number) {
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
      setSavedGroup(group)
      retry()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הכיתה')
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <LoadingSpinner />

  const currentGroup = savedGroup ?? session?.lesson_group ?? null

  return (
    <div className="min-h-screen p-4 max-w-md mx-auto">
      <PageHeader backHref="/menu" title="פרטים אישיים" />

      <div className="bg-white rounded-2xl shadow-md p-6 space-y-4">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">שם מלא</div>
          <div className="font-semibold text-gray-800">{session?.full_name}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">כיתה</div>
          <div className="font-semibold text-gray-800">{session?.class_name}</div>
        </div>

        {session?.has_lesson_groups && (
          <div>
            <div className="text-xs text-gray-400 mb-2">
              כיתה נוכחית בשיעור {currentGroup && `— כיתה ${currentGroup}`}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {GROUPS.map(group => (
                <button
                  key={group}
                  onClick={() => changeGroup(group)}
                  disabled={saving !== null}
                  className={`font-bold py-3 rounded-lg transition disabled:opacity-50 ${
                    currentGroup === group
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {saving === group ? '...' : `כיתה ${group}`}
                </button>
              ))}
            </div>
            {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
