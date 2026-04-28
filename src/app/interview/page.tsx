'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentSession } from '@/lib/types'

export default function InterviewLanding() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
  }, [router])

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center mt-4 mb-8">
        <button onClick={() => router.push('/menu')} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה לתפריט
        </button>
        <div className="text-sm text-gray-500">{session?.full_name}</div>
      </div>

      <div className="text-center mb-10">
        <div className="text-5xl mb-3">🗣️</div>
        <h1 className="text-2xl font-bold text-blue-700 mb-2">ראיון אישי</h1>
        <p className="text-gray-500 text-sm">תרגול לראיון אישי בעברית לקראת השירות הצבאי</p>
      </div>

      <div className="space-y-4">
        {/* Practice */}
        <button
          onClick={() => router.push('/interview/practice')}
          className="w-full text-right bg-white rounded-2xl border border-gray-200 p-6 hover:border-blue-400 hover:shadow-md transition group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl mb-2">📋</div>
              <h2 className="font-bold text-gray-800 text-lg group-hover:text-blue-700">תרגול שאלות</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                50 שאלות ראיון, שאלה אחר שאלה.<br />
                כתוב או הקלט את התשובות שלך.<br />
                <span className="text-gray-400">ללא ניקוד — לתרגול עצמאי</span>
              </p>
            </div>
            <span className="text-blue-400 text-2xl group-hover:translate-x-1 transition-transform">←</span>
          </div>
        </button>

        {/* Simulation */}
        <button
          onClick={() => router.push('/interview/simulate')}
          className="w-full text-right bg-blue-600 rounded-2xl border border-blue-600 p-6 hover:bg-blue-700 transition group shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-2xl mb-2">🤖</div>
              <h2 className="font-bold text-white text-lg">סימולציית ראיון עם AI</h2>
              <p className="text-sm text-blue-100 mt-1 leading-relaxed">
                15 שאלות עם מראיין AI.<br />
                קול + טקסט, ניתוח בסוף.<br />
                <span className="text-blue-200">ציון + פידבק מפורט מ-Gemini</span>
              </p>
            </div>
            <span className="text-white text-2xl group-hover:translate-x-1 transition-transform">←</span>
          </div>
        </button>
      </div>

      <div className="mt-8 bg-gray-50 rounded-xl p-4 text-sm text-gray-500 text-right">
        <p className="font-medium text-gray-700 mb-1">💡 טיפ</p>
        <p>התחל עם תרגול השאלות כדי להכיר את הנושאים, ואחרי כן נסה את סימולציית הראיון.</p>
      </div>
    </div>
  )
}
