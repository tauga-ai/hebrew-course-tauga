'use client'
import { shuffleWithSeed } from '@/lib/shuffle'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import type { StudentSession, Question, PracticeSet } from '@/lib/types'

// Deterministic shuffle using question id as seed — same order every time for same question
// moved to lib/shuffle.ts
function shuffleWithSeed_old(arr: number[], seed: number): number[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function PracticePage() {
  const router = useRouter()
  const params = useParams()
  const setId = Number(params.setId)

  const [session, setSession] = useState<StudentSession | null>(null)
  const [practiceSet, setPracticeSet] = useState<PracticeSet | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [currentIdx, setCurrentIdx] = useState(0)

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
    async function load() {
      const res = await fetch(`/api/practice-sets/${setId}`)
      const data = await res.json()
      if (!res.ok || !data.set) { router.replace('/menu'); return }
      setPracticeSet(data.set)
      setQuestions(data.questions || [])
      setLoading(false)
    }
    load()
  }, [setId, router])

  const q = questions[currentIdx]
  const total = questions.length
  const answered = Object.keys(answers).length
  const hebrewLabels = ['א', 'ב', 'ג', 'ד']

  // Compute shuffled display order per question (deterministic by question id)
  const shuffledOrder = useMemo(() => {
    if (!q) return [1, 2, 3, 4]
    return shuffleWithSeed([1, 2, 3, 4], q.id)
  }, [q?.id])

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
      setError(`יש לענות על כל השאלות. נותרו ${unanswered.length} שאלות ללא מענה.`)
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: session.id,
          practice_set_id: setId,
          answers: Object.entries(answers).map(([qId, ans]) => ({
            question_id: parseInt(qId),
            selected_answer_number: ans,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה')
      router.push(`/menu?completed=${setId}&score=${Math.round(data.score_percentage)}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחה')
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">טוען...</p>
    </div>
  )

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <button onClick={() => router.push('/menu')} className="text-sm text-gray-400 hover:text-gray-600">← חזרה</button>
        <div className="text-center">
          <div className="font-bold text-blue-700">סט {practiceSet?.set_number}</div>
          <div className="text-xs text-gray-500">{practiceSet?.topic}</div>
        </div>
        <div className="text-sm text-gray-500">{answered}/{total}</div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${(answered / total) * 100}%` }} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="text-xs text-gray-400 mb-3">שאלה {currentIdx + 1} מתוך {total}</div>
        <p className="text-gray-800 leading-relaxed text-base whitespace-pre-line">{q?.question_text}</p>
      </div>

      <div key={`opts-${q?.id}`} className="space-y-3 mb-6">
        {options.map((opt, i) => {
          const selected = answers[q?.id] === opt.num
          return (
            <button
              key={`${q?.id}-${opt.num}`}
              onClick={() => selectAnswer(q.id, opt.num)}
              className={`w-full text-right rounded-xl border p-4 transition flex items-center gap-3 ${
                selected ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-white border-gray-200 hover:border-blue-300 text-gray-800'
              }`}
            >
              <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                selected ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
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
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-30 hover:bg-gray-50">
          ← הקודמת
        </button>
        <div className="flex gap-1.5">
          {questions.map((qx, i) => (
            <button key={qx.id} onClick={() => setCurrentIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition ${i === currentIdx ? 'bg-blue-600' : answers[qx.id] ? 'bg-blue-300' : 'bg-gray-200'}`}
            />
          ))}
        </div>
        <button onClick={() => setCurrentIdx(i => Math.min(total - 1, i + 1))} disabled={currentIdx === total - 1}
          className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 disabled:opacity-30 hover:bg-gray-50">
          הבאה →
        </button>
      </div>

      {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

      <button onClick={handleSubmit} disabled={submitting}
        className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 transition disabled:opacity-50">
        {submitting ? 'שולח...' : `הגש (${answered}/${total} נענו)`}
      </button>
    </div>
  )
}
