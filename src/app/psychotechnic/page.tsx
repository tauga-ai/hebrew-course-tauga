'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PSYCHOTECHNIC_SETS } from '@/lib/psychotechnic'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft-storage'
import { PageHeader } from '@/components/PageHeader'
import { CardGrid } from '@/components/ui/CardGrid'
import { Card } from '@/components/ui/Card'

type Phase = 'select' | 'input' | 'result'

interface QuestionResult {
  q: number; correct: number; student: number; isCorrect: boolean
}

interface PsychotechnicDraft {
  selectedSetId: number
  answers: number[]
}

const draftKey = (studentId: string) => `psychotechnic_draft_${studentId}`

export default function PsychotechnicPage() {
  const router = useRouter()
  const { session } = useStudentSession()
  const [phase, setPhase] = useState<Phase>('select')
  const [selectedSetId, setSelectedSetId] = useState<number | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [results, setResults] = useState<{ results: QuestionResult[]; score: number; total: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const selectedSet = PSYCHOTECHNIC_SETS.find(s => s.id === selectedSetId)
  const numQuestions = selectedSet?.answers.length || 0

  // Restore an in-progress answer draft, if one was left behind by a refresh/navigation-away.
  useEffect(() => {
    if (!session) return
    function restoreDraft() {
      const draft = loadDraft<PsychotechnicDraft>(draftKey(session!.id))
      if (draft) {
        setSelectedSetId(draft.selectedSetId)
        setAnswers(draft.answers)
        setPhase('input')
      }
    }
    restoreDraft()
  }, [session])

  // Auto-save while a set is being answered.
  useEffect(() => {
    if (!session || phase !== 'input' || selectedSetId === null) return
    saveDraft(draftKey(session.id), { selectedSetId, answers })
  }, [session, phase, selectedSetId, answers])

  // Warn before leaving mid-answer — progress is saved, but a fresh tab still loses momentum.
  useEffect(() => {
    if (phase !== 'input') return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase])

  function selectSet(id: number) {
    setSelectedSetId(id)
    const set = PSYCHOTECHNIC_SETS.find(s => s.id === id)
    setAnswers(new Array(set?.answers.length || 10).fill(0))
    setPhase('input')
    setResults(null)
  }

  function setAnswer(questionIdx: number, answer: number) {
    setAnswers(prev => {
      const next = [...prev]
      next[questionIdx] = answer
      return next
    })
  }

  async function handleSubmit() {
    if (!session || !selectedSetId) return
    const unanswered = answers.filter(a => a === 0).length
    if (unanswered > 0) {
      alert(`יש לענות על כל השאלות. נותרו ${unanswered} ללא תשובה.`)
      return
    }
    setSubmitting(true)
    const res = await fetch('/api/psychotechnic/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        set_id: selectedSetId,
        answers,
      }),
    })
    const data = await res.json()
    if (session) clearDraft(draftKey(session.id))
    setResults(data)
    setPhase('result')
    setSubmitting(false)
  }

  const answeredCount = answers.filter(a => a > 0).length

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <PageHeader
        onBack={() => phase === 'input' ? setPhase('select') : router.push('/menu')}
        title="פסיכוטכני: הזנת תשובות"
        right={session?.full_name}
      />

      {/* ── SELECT SET ── */}
      {phase === 'select' && (
        <>
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 mb-5 text-sm text-primary-800 text-right">
            <p className="font-semibold mb-1">📋 איך זה עובד?</p>
            <p>ענית על מקבץ פסיכוטכני בדף הכתוב. בחר כאן את שם המקבץ שענית עליו, הכנס את התשובות שסימנת, ותקבל מיד את הציון שלך.</p>
          </div>
          <h2 className="text-base font-semibold text-fg/80 mb-3">בחר מקבץ:</h2>
          <CardGrid>
            {PSYCHOTECHNIC_SETS.map(set => (
              <Card
                key={set.id}
                icon="🧠"
                title={set.name}
                subtitle={`${set.answers.length} שאלות`}
                accentColor="psychotechnic"
                onClick={() => selectSet(set.id)}
                trailing={<span className="text-accent-psychotechnic">←</span>}
              />
            ))}
          </CardGrid>
        </>
      )}

      {/* ── INPUT ANSWERS ── */}
      {phase === 'input' && selectedSet && (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-gray-800">{selectedSet.name}</span>
              <span className="text-sm text-gray-500">{answeredCount}/{numQuestions} הוזנו</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / numQuestions) * 100}%` }} />
            </div>
          </div>

          <div className="space-y-3 mb-5">
            {Array.from({ length: numQuestions }, (_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-sm font-semibold text-gray-600 mb-3">שאלה {i + 1}</div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(i, opt)}
                      className={`py-3 rounded-xl text-base font-bold transition border-2 ${
                        answers[i] === opt
                          ? 'border-primary-500 bg-primary-500 text-white shadow-md scale-105'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleSubmit} disabled={submitting || answeredCount < numQuestions}
            className="w-full bg-primary-600 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-700 transition disabled:opacity-40 text-lg">
            {submitting ? 'שולח...' : `הגש (${answeredCount}/${numQuestions})`}
          </button>
          {answeredCount < numQuestions && (
            <p className="text-center text-orange-500 text-xs mt-2">יש עוד {numQuestions - answeredCount} שאלות ללא תשובה</p>
          )}
        </>
      )}

      {/* ── RESULTS ── */}
      {phase === 'result' && results && selectedSet && (
        <>
          {/* Score */}
          <div className={`rounded-2xl border p-6 text-center mb-4 ${
            results.score / results.total >= 0.7 ? 'bg-green-50 border-green-200' :
            results.score / results.total >= 0.5 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className={`text-6xl font-bold ${
              results.score / results.total >= 0.7 ? 'text-green-600' :
              results.score / results.total >= 0.5 ? 'text-yellow-600' : 'text-red-500'
            }`}>{results.score}/{results.total}</div>
            <div className="text-gray-500 text-sm mt-1">{Math.round((results.score / results.total) * 100)}% נכון</div>
            <div className="text-gray-600 text-sm font-medium mt-1">{selectedSet.name}</div>
          </div>

          {/* Per-question results */}
          <div className="space-y-2 mb-5">
            {results.results.map(r => (
              <div key={r.q} className={`rounded-xl border p-3 flex items-center justify-between ${
                r.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{r.isCorrect ? '✅' : '❌'}</span>
                  <span className="text-sm font-medium text-gray-700">שאלה {r.q}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-gray-500">סימנת: <strong>{r.student}</strong></span>
                  {!r.isCorrect && <span className="text-green-700">נכון: <strong>{r.correct}</strong></span>}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => { setPhase('select'); setResults(null) }}
              className="flex-1 bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 transition">
              מקבץ נוסף
            </button>
            <button onClick={() => router.push('/menu')}
              className="flex-1 border border-gray-200 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition">
              חזור לתפריט
            </button>
          </div>
        </>
      )}
    </div>
  )
}
