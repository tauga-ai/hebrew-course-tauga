'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALL_PRACTICE_QUESTIONS, CATEGORY_COLORS, type InterviewQuestion } from '@/lib/interview-questions'
import { stopSpeaking } from '@/lib/tts-client'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'

export default function PracticePage() {
  const router = useRouter()
  const { session } = useStudentSession()
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})

  const q: InterviewQuestion = ALL_PRACTICE_QUESTIONS[idx]
  const total = ALL_PRACTICE_QUESTIONS.length

  const { isListening, start: startListening, stop: stopListening, supported: speechSupported } = useSpeechToText({
    continuous: false,
    onTranscript: text => setAnswers(prev => ({ ...prev, [q.id]: text })),
  })

  useEffect(() => {
    if (window.speechSynthesis) window.speechSynthesis.getVoices()
  }, [])

  // Restore previously saved answers once the student session is ready.
  useEffect(() => {
    if (!session) return
    let cancelled = false
    fetch('/api/interview/practice-answers')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data?.answers) return
        setAnswers(prev => ({ ...data.answers, ...prev }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [session])

  // Not scored, just autosaved — persisted the moment the student leaves a
  // question (nav buttons or the dot strip), not on every keystroke.
  function saveAnswer(questionId: number, text: string | undefined) {
    if (!text) return
    fetch('/api/interview/practice-answers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id: questionId, answer_text: text }),
    }).catch(() => {})
  }

  function go(dir: number) {
    stopSpeaking()
    stopListening()
    saveAnswer(q.id, answers[q.id])
    setIdx(i => Math.max(0, Math.min(total - 1, i + dir)))
  }

  const answered = Object.keys(answers).length

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <PageHeader backHref="/interview" title="תרגול שאלות ראיון" subtitle={session?.full_name} right={`${answered}/${total} נענו`} />

      {/* Progress */}
      <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5 mb-6">
        <div className="bg-primary-500 h-1.5 rounded-full transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>

      {/* Question card */}
      <div className="bg-surface rounded-2xl border border-card-border p-6 mb-4 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <span className="text-xs text-fg/40">שאלה {idx + 1} מתוך {total}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[q.category]}`}>
            {q.category}
          </span>
        </div>
        <p className="text-xl font-semibold text-fg leading-relaxed">{q.text}</p>
      </div>

      {/* Answer area */}
      <div className="bg-surface rounded-2xl border border-card-border p-5 mb-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <label htmlFor="answer" className="text-sm font-medium text-fg/80">התשובה שלי</label>
          {speechSupported && (
            <button
              onClick={() => isListening ? stopListening() : startListening()}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition ${
                isListening
                  ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 animate-pulse'
                  : 'bg-black/5 dark:bg-white/5 text-fg/70 hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              <span>{isListening ? '⏹' : '🎤'}</span>
              <span>{isListening ? 'עצור' : 'הקלט'}</span>
            </button>
          )}
        </div>
        <textarea
          id="answer"
          value={answers[q.id] || ''}
          onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
          placeholder="כתוב את תשובתך כאן..."
          rows={4}
          className="w-full border border-card-border rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 bg-surface text-fg"
        />
        {isListening && (
          <p className="text-xs text-red-500 dark:text-red-400 mt-1 animate-pulse">🎤 מקליט... דבר בעברית</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => go(-1)}
          disabled={idx === 0}
          className="px-5 py-2.5 rounded-xl border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5"
        >
          ← קודמת
        </button>

        {/* Dots */}
        <div className="flex gap-1 flex-wrap justify-center max-w-xs">
          {ALL_PRACTICE_QUESTIONS.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => { stopSpeaking(); saveAnswer(q.id, answers[q.id]); setIdx(i) }}
              className={`w-2 h-2 rounded-full transition ${
                i === idx ? 'bg-primary-600 scale-125' : answers[qq.id] ? 'bg-primary-300' : 'bg-gray-200 dark:bg-white/10'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => go(1)}
          disabled={idx === total - 1}
          className="px-5 py-2.5 rounded-xl border border-card-border text-sm text-fg/70 disabled:opacity-30 hover:bg-black/5 dark:hover:bg-white/5"
        >
          הבאה →
        </button>
      </div>

      {answered === total && (
        <div className="bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800 rounded-xl p-4 text-center">
          <p className="text-green-700 dark:text-green-400 font-semibold">כל הכבוד! ענית על כל {total} השאלות 🎉</p>
          <button onClick={() => { saveAnswer(q.id, answers[q.id]); router.push('/interview') }} className="mt-2 text-sm text-green-600 dark:text-green-400 underline">
            חזור לתפריט
          </button>
        </div>
      )}
      </div>
    </div>
  )
}
