'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ALL_PRACTICE_QUESTIONS, CATEGORY_COLORS, type InterviewQuestion } from '@/lib/interview-questions'
import type { StudentSession } from '@/lib/types'
import { stopSpeaking } from '@/lib/use-hebrew-tts'

export default function PracticePage() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  const q: InterviewQuestion = ALL_PRACTICE_QUESTIONS[idx]
  const total = ALL_PRACTICE_QUESTIONS.length

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSpeechSupported(!!SR)
    if (window.speechSynthesis) window.speechSynthesis.getVoices()
  }, [router])

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'he-IL'
    rec.continuous = false
    rec.interimResults = true
    recognitionRef.current = rec

    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results)
        .map((r: any) => r[0].transcript)
        .join('')
      setAnswers(prev => ({ ...prev, [q.id]: transcript }))
    }

    rec.onend = () => setIsListening(false)
    rec.start()
    setIsListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  function go(dir: number) {
    stopSpeaking()
    recognitionRef.current?.stop()
    setIsListening(false)
    setIdx(i => Math.max(0, Math.min(total - 1, i + dir)))
  }

  const answered = Object.keys(answers).length

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mt-4 mb-6">
        <button onClick={() => router.push('/interview')} className="text-sm text-gray-400 hover:text-gray-600">
          ← חזרה
        </button>
        <div className="text-center">
          <div className="font-bold text-blue-700">תרגול שאלות ראיון</div>
          <div className="text-xs text-gray-500">{session?.full_name}</div>
        </div>
        <div className="text-sm text-gray-500">{answered}/{total} נענו</div>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4 shadow-sm">
        <div className="flex justify-between items-start mb-4">
          <span className="text-xs text-gray-400">שאלה {idx + 1} מתוך {total}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[q.category]}`}>
            {q.category}
          </span>
        </div>
        <p className="text-xl font-semibold text-gray-800 leading-relaxed">{q.text}</p>
      </div>

      {/* Answer area */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <label className="text-sm font-medium text-gray-700">התשובה שלי</label>
          {speechSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition ${
                isListening
                  ? 'bg-red-100 text-red-600 animate-pulse'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{isListening ? '⏹' : '🎤'}</span>
              <span>{isListening ? 'עצור' : 'הקלט'}</span>
            </button>
          )}
        </div>
        <textarea
          value={answers[q.id] || ''}
          onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
          placeholder="כתוב את תשובתך כאן..."
          rows={4}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800"
        />
        {isListening && (
          <p className="text-xs text-red-500 mt-1 animate-pulse">🎤 מקליט... דבר בעברית</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => go(-1)}
          disabled={idx === 0}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 disabled:opacity-30 hover:bg-gray-50"
        >
          ← קודמת
        </button>

        {/* Dots */}
        <div className="flex gap-1 flex-wrap justify-center max-w-xs">
          {ALL_PRACTICE_QUESTIONS.map((qq, i) => (
            <button
              key={qq.id}
              onClick={() => { stopSpeaking(); setIdx(i) }}
              className={`w-2 h-2 rounded-full transition ${
                i === idx ? 'bg-blue-600 scale-125' : answers[qq.id] ? 'bg-blue-300' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => go(1)}
          disabled={idx === total - 1}
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 disabled:opacity-30 hover:bg-gray-50"
        >
          הבאה →
        </button>
      </div>

      {answered === total && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-green-700 font-semibold">כל הכבוד! ענית על כל {total} השאלות 🎉</p>
          <button onClick={() => router.push('/interview')} className="mt-2 text-sm text-green-600 underline">
            חזור לתפריט
          </button>
        </div>
      )}
    </div>
  )
}
