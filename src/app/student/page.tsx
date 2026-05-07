'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StudentEntry() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [classId, setClassId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !classId) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName.trim(), class_id: parseInt(classId) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')

      localStorage.setItem('student_session', JSON.stringify({
        id: data.student.id,
        full_name: data.student.full_name,
        class_id: data.student.class_id,
        class_name: data.class_name,
      }))
      router.push('/menu')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בהתחברות')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-sm p-8">
        <h1 className="text-2xl font-bold text-center text-blue-700 mb-2">תרגול ניצנים</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">הבנת הנקרא</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="הכנס את שמך המלא"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כיתה</label>
            <select
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              <option value="">בחר כיתה</option>
              <option value="1">כיתה 1</option>
              <option value="2">כיתה 2</option>
            </select>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'טוען...' : 'כניסה'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/teacher/login" className="text-xs text-gray-400 hover:text-gray-600">
            כניסה למורה
          </a>
        </div>
      </div>
    </div>
  )
}
