'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PsychotechnicSetMeta } from '@/lib/psychotechnic'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft-storage'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
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
  const [error, setError] = useState('')
  const [sets, setSets] = useState<PsychotechnicSetMeta[]>([])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch('/api/psychotechnic/sets')
      .then(r => r.json())
      .then(data => { if (!cancelled) setSets(data.sets || []) })
      .catch(() => { if (!cancelled) setSets([]) })
    return () => { cancelled = true }
  }, [session])

  const selectedSet = sets.find(s => s.id === selectedSetId)
  const numQuestions = selectedSet?.questionCount || 0

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
    const set = sets.find(s => s.id === id)
    setAnswers(new Array(set?.questionCount || 10).fill(0))
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
    setError('')
    try {
      const res = await fetch('/api/psychotechnic/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          set_id: selectedSetId,
          answers,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'שגיאה בשליחת התשובות')
      if (session) clearDraft(draftKey(session.id))
      setResults(data)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת התשובות')
    } finally {
      setSubmitting(false)
    }
  }

  const answeredCount = answers.filter(a => a > 0).length

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <PageHeader
        onBack={() => phase === 'input' ? setPhase('select') : router.push('/menu')}
        title="פסיכוטכני: הזנת תשובות"
        right={session?.full_name}
      />

      {/* ── SELECT SET ── */}
      {phase === 'select' && (
        <>
          <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-800 rounded-xl p-4 mb-5 text-sm text-primary-800 dark:text-primary-300 text-right">
            <p className="font-semibold mb-1">📋 איך זה עובד?</p>
            <p>ענית על מקבץ פסיכוטכני בדף הכתוב. בחר כאן את שם המקבץ שענית עליו, הכנס את התשובות שסימנת, ותקבל מיד את הציון שלך.</p>
          </div>
          <h2 className="text-base font-semibold text-fg/80 mb-3">בחר מקבץ:</h2>
          <CardGrid>
            {sets.map(set => (
              <Card
                key={set.id}
                icon="🧠"
                title={set.name}
                subtitle={`${set.questionCount} שאלות`}
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
          <div className="bg-surface rounded-2xl border border-card-border p-4 mb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="font-semibold text-fg">{selectedSet.name}</span>
              <span className="text-sm text-fg/60">{answeredCount}/{numQuestions} הוזנו</span>
            </div>
            <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5">
              <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${(answeredCount / numQuestions) * 100}%` }} />
            </div>
          </div>

          <div className="space-y-3 mb-5">
            {Array.from({ length: numQuestions }, (_, i) => (
              <div key={i} className="bg-surface rounded-xl border border-card-border p-4">
                <div className="text-sm font-semibold text-fg/70 mb-3">שאלה {i + 1}</div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAnswer(i, opt)}
                      className={`py-3 rounded-xl text-base font-bold transition border-2 ${
                        answers[i] === opt
                          ? 'border-primary-500 bg-primary-500 text-white shadow-md scale-105'
                          : 'border-card-border bg-black/5 dark:bg-white/5 text-fg/70 hover:border-primary-300 hover:bg-primary-50 dark:hover:bg-primary-500/10'
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
          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mt-2">{error}</p>}
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
            results.score / results.total >= 0.7 ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' :
            results.score / results.total >= 0.5 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800' : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'
          }`}>
            <div className={`text-6xl font-bold ${
              results.score / results.total >= 0.7 ? 'text-green-600 dark:text-green-400' :
              results.score / results.total >= 0.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
            }`}>{results.score}/{results.total}</div>
            <div className="text-fg/60 text-sm mt-1">{Math.round((results.score / results.total) * 100)}% נכון</div>
            <div className="text-fg/70 text-sm font-medium mt-1">{selectedSet.name}</div>
          </div>

          {/* Per-question results */}
          <div className="space-y-2 mb-5">
            {results.results.map(r => (
              <div key={r.q} className={`rounded-xl border p-3 flex items-center justify-between ${
                r.isCorrect ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{r.isCorrect ? '✅' : '❌'}</span>
                  <span className="text-sm font-medium text-fg/80">שאלה {r.q}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-fg/60">סימנת: <strong>{r.student}</strong></span>
                  {!r.isCorrect && <span className="text-green-700 dark:text-green-400">נכון: <strong>{r.correct}</strong></span>}
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
              className="flex-1 border border-card-border text-fg/70 font-semibold py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition">
              חזור לתפריט
            </button>
          </div>
        </>
      )}
      </div>
    </div>
  )
}
