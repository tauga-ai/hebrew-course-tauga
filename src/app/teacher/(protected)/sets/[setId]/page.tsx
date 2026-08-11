'use client'

import { useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTeacherAuth } from '@/lib/hooks/use-teacher-auth'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { scoreColor } from '@/lib/score-color'
import { t } from '@/lib/dev-i18n'

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
  const { email } = useTeacherAuth()

  const { data, loading, error } = useResource<SetData>(email ? `/api/teacher/sets/${setId}` : null)

  useEffect(() => {
    if (error) router.replace('/teacher/dashboard')
  }, [error, router])

  if (loading) return <LoadingSpinner />
  if (!data) return null

  return (
    <>
      <div className="bg-surface rounded-2xl border border-card-border p-5 mb-6">
        <h1 className="text-xl font-bold text-primary-700 dark:text-primary-400">
          {t('סט')} {data.practice_set.set_number}: {t('ניתוח שאלות')}
        </h1>
        <p className="text-sm text-fg/60 mt-1">{data.practice_set.topic} · {t('רמה')} {data.practice_set.difficulty_level} · {data.class_name}</p>
        <div className="flex gap-6 mt-3 text-sm">
          <div>
            <span className="text-fg/60">{t('השלימו')}: </span>
            <span className="font-bold text-fg">{data.total_submissions}</span>
          </div>
          <div>
            <span className="text-fg/60">{t('ממוצע')}: </span>
            <span className={`font-bold ${scoreColor(data.avg_score, { emptyClass: 'text-fg/40' })}`}>
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
            <div key={q.id} className="bg-surface rounded-2xl border border-card-border p-5">
              {/* Question header */}
              <div className="flex justify-between items-start mb-3">
                <span className="text-xs font-semibold text-fg/40 uppercase tracking-wide">
                  {t('שאלה')} {qi + 1}
                </span>
                {total > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(correctPct, {
                    palette: {
                      good: 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
                      ok: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
                      bad: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400',
                    },
                  })}`}>
                    {correctPct}% {t('ענו נכון')} ({q.correct_count}/{total})
                  </span>
                )}
                {total === 0 && (
                  <span className="text-xs text-fg/30">{t('אין תשובות עדיין')}</span>
                )}
              </div>

              {/* Question text */}
              <p className="text-fg leading-relaxed mb-4 whitespace-pre-line text-sm">
                {q.question_text}
              </p>

              {/* Answer options with distribution bars */}
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const optNum = i + 1
                  const count = q.answer_distribution[optNum] || 0
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0
                  const isCorrect = optNum === q.correct_answer_number

                  return (
                    <div key={optNum} className={`rounded-xl border p-3 ${
                      isCorrect
                        ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/40'
                        : count > 0
                        ? 'border-red-100 bg-red-50 dark:border-red-900 dark:bg-red-950/40'
                        : 'border-card-border bg-black/5 dark:bg-white/5'
                    }`}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isCorrect
                            ? 'bg-green-500 text-white'
                            : count > 0
                            ? 'bg-red-400 text-white'
                            : 'bg-gray-200 dark:bg-white/10 text-fg/60'
                        }`}>
                          {t(HEBREW[i])}
                        </span>
                        <span className={`text-sm flex-1 ${isCorrect ? 'font-semibold text-green-800 dark:text-green-300' : 'text-fg/80'}`}>
                          {opt}
                        </span>
                        {isCorrect && (
                          <span className="text-green-600 dark:text-green-400 text-xs font-bold">✓ {t('נכון')}</span>
                        )}
                        <span className={`text-xs font-semibold ml-1 ${
                          isCorrect ? 'text-green-700 dark:text-green-400' : count > 0 ? 'text-red-500 dark:text-red-400' : 'text-fg/40'
                        }`}>
                          {count > 0 || total > 0 ? `${count} (${pct}%)` : '—'}
                        </span>
                      </div>

                      {/* Distribution bar */}
                      {total > 0 && (
                        <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5 mr-7">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              isCorrect ? 'bg-green-500' : count > 0 ? 'bg-red-400' : 'bg-gray-300 dark:bg-white/20'
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
    </>
  )
}
