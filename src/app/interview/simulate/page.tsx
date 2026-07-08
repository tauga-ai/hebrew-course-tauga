'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildSimulationQuestions, CATEGORY_COLORS, type InterviewQuestion } from '@/lib/interview-questions'
import type { InterviewFeedback } from '@/app/api/interview/feedback/route'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'

type Phase = 'intro' | 'question' | 'processing' | 'results'

export default function SimulatePage() {
  const router = useRouter()
  const { session } = useStudentSession()
  // Lazy initial state: picked once on first render, no need for a separate effect.
  const [questions] = useState<InterviewQuestion[]>(buildSimulationQuestions)
  const [phase, setPhase] = useState<Phase>('intro')
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<string[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null)

  const { isListening, start: startListening, stop: stopListening, supported: speechSupported } = useSpeechToText({
    onTranscript: setCurrentAnswer,
  })

  function startInterview() {
    setPhase('question')
    setIdx(0)
    setAnswers([])
    setCurrentAnswer('')
  }

  function submitAnswer() {
    stopListening()                        // fully kill recognition first
    const newAnswers = [...answers, currentAnswer]
    setAnswers(newAnswers)
    setCurrentAnswer('')                  // now safe to clear

    if (idx + 1 >= questions.length) {
      submitForFeedback(newAnswers)
    } else {
      setIdx(idx + 1)
    }
  }

  async function submitForFeedback(allAnswers: string[]) {
    setPhase('processing')
    const qa_pairs = questions.map((q, i) => ({
      question: q.text,
      answer: allAnswers[i] || '',
    }))
    try {
      const res = await fetch('/api/interview/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: session?.full_name, qa_pairs }),
      })
      const data = await res.json()
      setFeedback(data.feedback)
      setPhase('results')
      if (session) {
        fetch('/api/interview/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: data.feedback.score, level: data.feedback.level }),
        }).catch(() => {})
      }
    } catch {
      alert('שגיאה בעיבוד הפידבק. נסה שוב.')
      setPhase('intro')
    }
  }

  const q = questions[idx]
  const progress = questions.length > 0 ? (idx / questions.length) * 100 : 0

  // ── INTRO ──────────────────────────────────────────────────────────────────
  if (phase === 'intro') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">🎤</div>
        <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mb-2">סימולציית ראיון</h1>
        <p className="text-fg/60 mb-1 text-sm">שלום, <strong>{session?.full_name}</strong></p>
        <p className="text-fg/70 mb-6 text-sm leading-relaxed">
          תענה על <strong>15 שאלות</strong>: 6 חובה + 9 רנדומליות.<br />
          בסוף תקבל ציון ופידבק מפורט מ-Gemini.
        </p>
        <div className="bg-primary-50 dark:bg-primary-500/10 rounded-xl p-4 mb-6 text-right space-y-1 text-sm text-fg/70">
          <p>✅ ענה בכתב או הקלט את קולך (🎤)</p>
          <p>✅ אפשר לדלג על שאלה</p>
          <p>✅ אחרי 15 שאלות, Gemini מנתח ונותן פידבק</p>
        </div>
        <button onClick={startInterview}
          className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 transition text-lg">
          התחל ראיון
        </button>
        <button onClick={() => router.push('/interview')} className="mt-3 text-sm text-fg/40 hover:text-fg/70">
          חזרה
        </button>
      </div>
    </div>
  )

  // ── PROCESSING ─────────────────────────────────────────────────────────────
  if (phase === 'processing') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">🤖</div>
        <h2 className="text-xl font-bold text-primary-700 dark:text-primary-400 mb-2">מנתח את הראיון...</h2>
        <p className="text-fg/60 text-sm">Gemini בודק את תשובותיך ומכין פידבק מפורט</p>
        <div className="mt-6 flex gap-2 justify-center">
          {[0,1,2].map(i => (
            <div key={i} className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  )

  // ── RESULTS ────────────────────────────────────────────────────────────────
  if (phase === 'results' && feedback) {
    const scoreColor = feedback.score >= 80 ? 'text-green-600 dark:text-green-400' : feedback.score >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'
    const scoreBg = feedback.score >= 80 ? 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800' : feedback.score >= 60 ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800' : 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800'
    return (
      <div className="min-h-screen p-4 max-w-2xl mx-auto">
        <div className="flex justify-between items-center mt-4 mb-6">
          <button onClick={() => router.push('/interview')} className="text-sm text-fg/40 hover:text-fg/70">← תפריט</button>
          <h1 className="font-bold text-primary-700 dark:text-primary-400">תוצאות הראיון</h1>
          <button onClick={() => { setPhase('intro'); setFeedback(null) }} className="text-sm text-primary-500 hover:text-primary-700 dark:hover:text-primary-400">נסה שוב</button>
        </div>

        <div className={`rounded-2xl border p-6 text-center mb-4 ${scoreBg}`}>
          <div className={`text-6xl font-bold ${scoreColor}`}>{feedback.score}</div>
          <div className="text-fg/60 text-sm">מתוך 100</div>
          <div className={`text-lg font-semibold mt-1 ${scoreColor}`}>{feedback.level}</div>
        </div>

        <div className="bg-surface rounded-2xl border border-card-border p-5 mb-4">
          <h2 className="font-semibold text-fg mb-2">סיכום</h2>
          <p className="text-fg/80 text-sm leading-relaxed">{feedback.summary}</p>
        </div>

        {feedback.strengths.length > 0 && (
          <div className="bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800 rounded-2xl p-5 mb-4">
            <h2 className="font-semibold text-green-800 dark:text-green-300 mb-3">✅ נקודות חוזק</h2>
            <ul className="space-y-1.5">
              {feedback.strengths.map((s, i) => (
                <li key={i} className="text-sm text-green-700 dark:text-green-400 flex gap-2"><span>•</span><span>{s}</span></li>
              ))}
            </ul>
          </div>
        )}

        {feedback.improvements.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 dark:bg-orange-950/40 dark:border-orange-800 rounded-2xl p-5 mb-4">
            <h2 className="font-semibold text-orange-800 dark:text-orange-300 mb-3">💡 נקודות לשיפור</h2>
            <ul className="space-y-1.5">
              {feedback.improvements.map((s, i) => (
                <li key={i} className="text-sm text-orange-700 dark:text-orange-400 flex gap-2"><span>•</span><span>{s}</span></li>
              ))}
            </ul>
          </div>
        )}

        {feedback.corrections.length > 0 && (
          <div className="bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 rounded-2xl p-5 mb-4">
            <h2 className="font-semibold text-red-800 dark:text-red-300 mb-3">✏️ תיקוני עברית</h2>
            <div className="space-y-3">
              {feedback.corrections.map((c, i) => (
                <div key={i} className="text-sm bg-surface rounded-xl p-3 border border-red-100 dark:border-red-900">
                  <div className="text-red-600 dark:text-red-400 line-through mb-0.5">{c.original}</div>
                  <div className="text-green-700 dark:text-green-400 font-semibold mb-0.5">← {c.corrected}</div>
                  <div className="text-fg/60 text-xs">{c.explanation}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {feedback.tips.length > 0 && (
          <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-800 rounded-2xl p-5 mb-6">
            <h2 className="font-semibold text-primary-800 dark:text-primary-300 mb-3">🎯 טיפים לשיפור</h2>
            <ul className="space-y-1.5">
              {feedback.tips.map((t, i) => (
                <li key={i} className="text-sm text-primary-700 dark:text-primary-400 flex gap-2"><span>•</span><span>{t}</span></li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={() => router.push('/menu')}
          className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 transition">
          חזור לתפריט הראשי
        </button>
      </div>
    )
  }

  // ── QUESTION ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-4">
        <span className="text-sm text-fg/60">ראיון אישי</span>
        <span className="text-sm font-semibold text-fg/80">שאלה {idx + 1} / {questions.length}</span>
      </div>

      <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 mb-6">
        <div className="bg-primary-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="bg-surface rounded-2xl border border-card-border shadow-sm p-6 mb-4">
        <div className="flex justify-between items-start mb-4">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${q ? CATEGORY_COLORS[q.category] : ''}`}>
            {q?.category}
          </span>
          {idx < 6 && <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400 px-2 py-0.5 rounded-full">חובה</span>}
        </div>
        <p className="text-2xl font-semibold text-fg leading-relaxed">{q?.text}</p>
      </div>

      <div className="bg-surface rounded-2xl border border-card-border shadow-sm p-5 mb-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-fg/80">התשובה שלי</span>
          {speechSupported && (
            <button
              onClick={() => isListening ? stopListening() : startListening()}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition font-medium ${
                isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-primary-100 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-500/20'
              }`}
            >
              {isListening ? '⏹ עצור' : '🎤 הקלט את עצמך'}
            </button>
          )}
        </div>
        <textarea
          value={currentAnswer}
          onChange={e => setCurrentAnswer(e.target.value)}
          placeholder="כתוב את תשובתך כאן, או הקלט את עצמך..."
          rows={5}
          className="w-full border border-card-border rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 bg-surface text-fg text-base"
        />
        {isListening && <p className="text-xs text-red-500 dark:text-red-400 mt-1 animate-pulse">🎤 מקליט... לחץ ״עצור״ כשתסיים</p>}
      </div>

      <button onClick={submitAnswer}
        className="w-full bg-primary-600 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-700 transition text-lg">
        {idx + 1 === questions.length ? 'סיים ושלח לניתוח' : `שאלה הבאה (${idx + 2}/${questions.length})`}
      </button>
      <button onClick={submitAnswer} className="w-full mt-2 text-sm text-fg/40 hover:text-fg/60 py-1">
        דלג על שאלה זו
      </button>
    </div>
  )
}
