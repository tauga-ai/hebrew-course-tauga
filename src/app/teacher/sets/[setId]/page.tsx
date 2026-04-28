'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface QuestionAnalytics {
  id: number
  question_order: number
  question_text: string
  options: string[]
  correct_answer_number: number
  answer_distribution: Record<string, number>
  correct_count: number
  total_answers: number
}

interface SetData {
  practice_set: { set_number: number; topic: string; difficulty_level: number }
  class_name: string
  total_submissions: number
  avg_score: number | null
  questions: QuestionAnalytics[]
}

const HEBREW = ['א', 'ב', 'ג', 'ד']

export default function SetAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const setId = params.setId as string

  const [data, setData] = useState<SetData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/teacher/login'); return }

      const res = await fetch(
        `/api/teacher/sets/${setId}?email=${encodeURIComponent(user.email || '')}`
      )
      if (!res.ok) { router.replace('/teacher/dashboard'); return }
      const d = await res.json()
      setData(d)
      setLoading(false)
    }
    load()
  }, [setId, router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">טוען...</p>
    </div>
  )
  if (!data) return null

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mt-4 mb-2">
        <button
          onClick={() => router.push('/teacher/dashboard')}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← חזרה לדשבורד
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <h1 className="text-xl font-bold text-blue-700">
          סט {data.practice_set.set_number} — ניתוח שאלות
        </h1>
        <p className="text-sm text-gray-500 mt-1">{data.practice_set.topic} · רמה {data.practice_set.difficulty_level} · {data.class_name}</p>
        <div className="flex gap-6 mt-3 text-sm">
          <div>
            <span className="text-gray-500">השלימו: </span>
            <span className="font-bold text-gray-800">{data.total_submissions}</span>
          </div>
          <div>
            <span className="text-gray-500">ממוצע: </span>
            <span className={`font-bold ${
              data.avg_score === null ? 'text-gray-400' :
              data.avg_score >= 70 ? 'text-green-600' : 'text-red-500'
            }`}>
              {data.avg_score === null ? '—' : `${Math.round(data.avg_score)}%`}
            </span>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-5">
        {data.questions.map((q, qi) => {
          const total = q.total_answers
          const correctPct = total > 0 ? Math.round((q.correct_count / total) * 100) : null

          return (
            <div key={q.id} className="bg-white rounded-2xl border border-gray-200 p-5">
              {/* Question header */}
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  שאלה {qi + 1}
                </span>
                {total > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    correctPct !== null && correctPct >= 70
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-600'
                  }`}>
                    {correctPct}% ענו נכון ({q.correct_count}/{total})
                  </span>
                )}
                {total === 0 && (
                  <span className="text-xs text-gray-300">אין תשובות עדיין</span>
                )}
              </div>

              {/* Question text */}
              <p className="text-gray-800 leading-relaxed mb-4 whitespace-pre-line text-sm">
                {q.question_text}
              </p>

              {/* Answer options with distribution bars */}
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const optNum = i + 1
                  const count = q.answer_distribution[optNum] || 0
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  const isCorrect = optNum === q.correct_answer_number
                  const isMostWrong = !isCorrect && count > 0 && count === Math.max(
                    ...q.options.map((_, j) => {
                      const n = j + 1
                      return n !== q.correct_answer_number ? (q.answer_distribution[n] || 0) : 0
                    })
                  )

                  return (
                    <div key={optNum} className={`rounded-xl border p-3 ${
                      isCorrect
                        ? 'border-green-300 bg-green-50'
                        : count > 0
                        ? 'border-red-100 bg-red-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isCorrect
                            ? 'bg-green-500 text-white'
                            : count > 0
                            ? 'bg-red-400 text-white'
                            : 'bg-gray-200 text-gray-500'
                        }`}>
                          {HEBREW[i]}
                        </span>
                        <span className={`text-sm flex-1 ${isCorrect ? 'font-semibold text-green-800' : 'text-gray-700'}`}>
                          {opt}
                        </span>
                        {isCorrect && (
                          <span className="text-green-600 text-xs font-bold">✓ נכון</span>
                        )}
                        <span className={`text-xs font-semibold ml-1 ${
                          isCorrect ? 'text-green-700' : count > 0 ? 'text-red-500' : 'text-gray-400'
                        }`}>
                          {count > 0 || total > 0 ? `${count} (${pct}%)` : '—'}
                        </span>
                      </div>

                      {/* Distribution bar */}
                      {total > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mr-7">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              isCorrect ? 'bg-green-500' : count > 0 ? 'bg-red-400' : 'bg-gray-300'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
