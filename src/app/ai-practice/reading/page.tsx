'use client'

import { useState } from 'react'
import type { AIReadingQuestion } from '@/app/api/ai-practice/reading/route'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { t } from '@/lib/dev-i18n'

const LEVEL_LABELS: Record<number, string> = {
  1: t('משפטים פשוטים: מי, מה, איפה'),
  2: t('סיבות וזמנים: למה, מתי'),
  3: t('ניגודים ורעיונות: למרות ש, כי'),
  4: t('קטעים מידעיים: פסקה שלמה'),
  5: t('קטעים מתקדמים: ניתוח ומסקנות'),
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400',
  2: 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-500/10 dark:text-primary-400',
  3: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400',
  4: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-400',
  5: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400',
}

const HEBREW = [t('א'), t('ב'), t('ג'), t('ד')]

type Phase = 'pick' | 'loading' | 'question' | 'result'

export default function AIReadingPage() {
  useStudentSession() // guards this page; redirects unauthenticated users
  const [level, setLevel] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [question, setQuestion] = useState<AIReadingQuestion | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [stats, setStats] = useState({ correct: 0, total: 0 })
  const [error, setError] = useState('')

  async function generateQuestion(lvl: number) {
    setLevel(lvl)
    setPhase('loading')
    setSelected(null)
    setError('')
    try {
      const res = await fetch('/api/ai-practice/reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: lvl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const q = data.question as AIReadingQuestion
      if (!Array.isArray(q?.options) || q.options.length !== 4 || !Number.isInteger(q.correct_index) || q.correct_index < 0 || q.correct_index > 3) {
        throw new Error(t('שאלה לא תקינה'))
      }
      setQuestion(q)
      setPhase('question')
    } catch {
      setError(t('שגיאה ביצירת השאלה. נסה שוב.'))
      setPhase('pick')
    }
  }

  function submitAnswer() {
    if (selected === null || !question) return
    const isCorrect = selected === question.correct_index
    setStats(s => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }))
    setPhase('result')
    if (level !== null) {
      fetch('/api/ai-practice/reading/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, is_correct: isCorrect }),
      }).catch(() => {})
    }
  }

  const isCorrect = selected !== null && question !== null && selected === question.correct_index

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <PageHeader
        backHref="/menu"
        backLabel={t('← תפריט')}
        title={t('הבנת הנקרא עם AI')}
        subtitle={level ? `${t('רמה')} ${level}` : undefined}
        right={stats.total > 0 ? `${stats.correct}/${stats.total} ✓` : undefined}
      />

      {/* ── PICK LEVEL ── */}
      {phase === 'pick' && (
        <>
          <p className="text-center text-fg/60 text-sm mb-6">{t('בחר רמה וה-AI יצור לך שאלה בהבנת הנקרא')}</p>
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map(lvl => (
              <button
                key={lvl}
                onClick={() => generateQuestion(lvl)}
                className={`w-full text-right rounded-2xl border-2 p-4 transition hover:shadow-md ${LEVEL_COLORS[lvl]}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold">{t('רמה')} {lvl}</div>
                    <div className="text-xs mt-0.5 opacity-80">{LEVEL_LABELS[lvl]}</div>
                  </div>
                  <span className="text-lg">←</span>
                </div>
              </button>
            ))}
          </div>
          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mt-4">{error}</p>}
          {stats.total > 0 && (
            <div className="mt-6 bg-black/5 dark:bg-white/5 rounded-xl p-4 text-center text-sm text-fg/70">
              {t('סיכום')}: {stats.correct} {t('נכון מתוך')} {stats.total} ({Math.round((stats.correct / stats.total) * 100)}%)
            </div>
          )}
        </>
      )}

      {/* ── LOADING ── */}
      {phase === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-64 gap-4">
          <div className="text-4xl animate-spin">🤖</div>
          <p className="text-fg/60">{t('יוצר שאלה ברמה')} {level}...</p>
        </div>
      )}

      {/* ── QUESTION ── */}
      {phase === 'question' && question && (
        <>
          <div className="bg-surface rounded-2xl border border-card-border shadow-sm p-6 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[level!]}`}>
                {t('רמה')} {level}
              </span>
              <span className="text-xs text-fg/40">{t('קרא את הטקסט וענה על השאלה')}</span>
            </div>
            <p className="text-fg leading-relaxed text-base mb-5 whitespace-pre-line border-b border-card-border pb-4">
              {question.passage}
            </p>
            <p className="text-fg/80 font-semibold leading-relaxed">{question.question}</p>
          </div>

          <div className="space-y-3 mb-6">
            {question.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-full text-right rounded-xl border p-4 transition flex items-center gap-3 ${
                  selected === i
                    ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-400 text-primary-800 dark:text-primary-300'
                    : 'bg-surface border-card-border hover:border-primary-300 text-fg'
                }`}
              >
                <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  selected === i ? 'bg-primary-500 text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70'
                }`}>
                  {HEBREW[i]}
                </span>
                <span>{opt}</span>
              </button>
            ))}
          </div>

          <button
            onClick={submitAnswer}
            disabled={selected === null}
            className="w-full bg-primary-600 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-700 transition disabled:opacity-40 text-lg"
          >
            {t('בדוק תשובה')}
          </button>
        </>
      )}

      {/* ── RESULT ── */}
      {phase === 'result' && question && selected !== null && (
        <>
          {/* Result banner */}
          <div className={`rounded-2xl border p-5 text-center mb-4 ${isCorrect ? 'bg-green-50 border-green-300 dark:bg-green-950/40 dark:border-green-700' : 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-700'}`}>
            <div className="text-4xl mb-2">{isCorrect ? '✅' : '❌'}</div>
            <div className={`text-xl font-bold ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {isCorrect ? t('נכון!') : t('לא נכון')}
            </div>
            {!isCorrect && (
              <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                {t('התשובה הנכונה')}: <strong>{HEBREW[question.correct_index]}. {question.options[question.correct_index]}</strong>
              </div>
            )}
          </div>

          {/* Passage + highlighted answer */}
          <div className="bg-surface rounded-2xl border border-card-border p-5 mb-3">
            <p className="text-xs text-fg/40 mb-2">{t('הטקסט')}</p>
            <p className="text-fg leading-relaxed text-sm mb-3">{question.passage}</p>
            <p className="text-xs text-fg/40 mb-1">{t('השאלה')}: {question.question}</p>
          </div>

          {/* Options with result */}
          <div className="space-y-2 mb-4">
            {question.options.map((opt, i) => {
              const isRight = i === question.correct_index
              const isChosen = i === selected
              return (
                <div key={i} className={`rounded-xl border p-3 flex items-center gap-3 ${
                  isRight ? 'bg-green-50 border-green-300 dark:bg-green-950/40 dark:border-green-700' :
                  isChosen && !isRight ? 'bg-red-50 border-red-300 dark:bg-red-950/40 dark:border-red-700' :
                  'bg-black/5 dark:bg-white/5 border-card-border'
                }`}>
                  <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isRight ? 'bg-green-500 text-white' :
                    isChosen ? 'bg-red-400 text-white' :
                    'bg-gray-200 dark:bg-white/10 text-fg/60'
                  }`}>{HEBREW[i]}</span>
                  <span className={`text-sm ${isRight ? 'text-green-800 dark:text-green-300 font-semibold' : isChosen ? 'text-red-700 dark:text-red-400' : 'text-fg/60'}`}>
                    {opt}
                  </span>
                  {isRight && <span className="mr-auto text-green-600 dark:text-green-400 text-xs font-bold">{t('✓ נכון')}</span>}
                </div>
              )
            })}
          </div>

          {/* Explanation */}
          {question.explanation && (
            <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-800 rounded-xl p-4 mb-4 text-sm text-primary-800 dark:text-primary-300">
              <strong>{t('הסבר')}: </strong>{question.explanation}
            </div>
          )}

          <button
            onClick={() => { setPhase('pick'); setQuestion(null); setSelected(null) }}
            className="w-full bg-primary-600 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-700 transition text-lg"
          >
            {t('צור תרגיל נוסף')}
          </button>
          <button
            onClick={() => generateQuestion(level!)}
            className="w-full mt-2 text-sm text-primary-500 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 py-2"
          >
            {t('תרגיל נוסף באותה רמה')} ({level})
          </button>
        </>
      )}
      </div>
    </div>
  )
}
