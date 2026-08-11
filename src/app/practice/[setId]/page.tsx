'use client'
import { shuffleWithSeed } from '@/lib/shuffle'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { Question, PracticeSet } from '@/lib/types'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useResource } from '@/lib/hooks/use-resource'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { scoreColor } from '@/lib/score-color'
import { t } from '@/lib/dev-i18n'

interface SubmitResult {
  score_percentage: number
  correct_count: number
  total_questions: number
}

export default function PracticePage() {
  const router = useRouter()
  const params = useParams()
  const setId = Number(params.setId)
  const { session } = useStudentSession()

  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [result, setResult] = useState<SubmitResult | null>(null)

  const { data, loading, error: loadError } = useResource<{ set: PracticeSet; questions: Question[] }>(
    session ? `/api/practice-sets/${setId}` : null
  )
  const practiceSet = data?.set ?? null
  const questions = data?.questions ?? []

  useEffect(() => {
    if (loadError) router.replace('/menu')
  }, [loadError, router])

  const q = questions[currentIdx]
  const total = questions.length
  const answered = Object.keys(answers).length
  const hebrewLabels = [t('א'), t('ב'), t('ג'), t('ד')]

  // Compute shuffled display order per question (deterministic by question id)
  const shuffledOrder = useMemo(() => {
    if (!q) return [1, 2, 3, 4]
    return shuffleWithSeed([1, 2, 3, 4], q.id)
  }, [q])

  const options = q ? shuffledOrder.map(num => ({
    num,
    text: q[`answer_option_${num}` as keyof Question] as string,
  })) : []

  function selectAnswer(questionId: number, answerNum: number) {
    setAnswers(prev => ({ ...prev, [questionId]: answerNum }))
  }

  async function handleSubmit() {
    if (!session) return
    const unanswered = questions.filter(q => !answers[q.id])
    if (unanswered.length > 0) {
      setError(`${t('יש לענות על כל השאלות. נותרו')} ${unanswered.length} ${t('שאלות ללא מענה.')}`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          practice_set_id: setId,
          answers: Object.entries(answers).map(([qId, ans]) => ({
            question_id: parseInt(qId),
            selected_answer_number: ans,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('שגיאה'))
      setResult(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('שגיאה בשליחה'))
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingSpinner />

  if (result) {
    return (
      <div className="min-h-screen md:flex">
        <StudentSidebar />
        <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
          <PageHeader backHref="/reading-sets" title={`${t('סט')} ${practiceSet?.set_number}`} subtitle={practiceSet?.topic} />
          <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 text-center">
            <div className="text-4xl mb-2">{result.score_percentage === 100 ? '🎉' : '✅'}</div>
            <h2 className="text-lg font-bold text-fg mb-1">{t('סיימת את הסט!')}</h2>
            <p className="text-fg/70 mb-2">{`${result.correct_count}/${result.total_questions}`} {t('תשובות נכונות')}</p>
            <p className={`text-3xl font-bold mb-4 ${scoreColor(result.score_percentage)}`}>{Math.round(result.score_percentage)}%</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => router.push('/reading-sets')}
                className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:opacity-90 transition"
              >
                {t('לרשימת הסטים')}
              </button>
              <button
                onClick={() => router.push('/menu')}
                className="w-full py-3 rounded-xl border border-card-border text-fg/70 hover:bg-black/5 dark:hover:bg-white/5 transition"
              >
                {t('לתפריט הראשי')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <PageHeader backHref="/menu" title={`${t('סט')} ${practiceSet?.set_number}`} subtitle={practiceSet?.topic} right={`${answered}/${total}`} />

      <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 mb-6">
        <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${(answered / total) * 100}%` }} />
      </div>

      <div className="bg-surface rounded-2xl shadow-sm border border-card-border p-6 mb-4">
        <div className="text-xs text-fg/40 mb-3">{t('שאלה')} {currentIdx + 1} {t('מתוך')} {total}</div>
        <p className="text-fg leading-relaxed text-base whitespace-pre-line">{q?.question_text}</p>
      </div>

      <div key={`opts-${q?.id}`} className="space-y-3 mb-6">
        {options.map((opt, i) => {
          const selected = answers[q?.id] === opt.num
          return (
            <button
              key={`${q?.id}-${opt.num}`}
              onClick={() => selectAnswer(q.id, opt.num)}
              className={`w-full text-right rounded-xl border p-4 transition flex items-center gap-3 ${
                selected ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-400 text-primary-800 dark:text-primary-300' : 'bg-surface border-card-border hover:border-primary-300 text-fg'
              }`}
            >
              <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                selected ? 'bg-primary-500 text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70'
              }`}>
                {hebrewLabels[i]}
              </span>
              <span>{opt.text}</span>
            </button>
          )
        })}
      </div>

      <div className="flex justify-between items-center mb-4">
        <button onClick={() => setCurrentIdx(i => Math.max(0, i - 1))} disabled={currentIdx === 0}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5">
          {t('← הקודמת')}
        </button>
        <div className="flex gap-1.5">
          {questions.map((qx, i) => (
            <button key={qx.id} onClick={() => setCurrentIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition ${i === currentIdx ? 'bg-primary-600' : answers[qx.id] ? 'bg-primary-300' : 'bg-gray-200 dark:bg-white/10'}`}
            />
          ))}
        </div>
        <button onClick={() => setCurrentIdx(i => Math.min(total - 1, i + 1))} disabled={currentIdx === total - 1}
          className="px-4 py-2 rounded-lg border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5">
          {t('הבאה →')}
        </button>
      </div>

      {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mb-4">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting}
        className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition disabled:opacity-50">
        {submitting ? t('שולח...') : `${t('הגש')} (${answered}/${total} ${t('נענו')})`}
      </button>
      </div>
    </div>
  )
}
