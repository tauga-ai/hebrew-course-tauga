'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { SENTENCE_SETS, DIFFICULTY_COLORS } from '@/lib/sentence-exercises'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import type { StudentSession } from '@/lib/types'

type Phase = 'input' | 'loading' | 'result'

export default function SentenceSetPage() {
  const router = useRouter()
  const params = useParams()
  const setId = Number(params.setId)

  const set = SENTENCE_SETS.find(s => s.id === setId)

  const [session, setSession] = useState<StudentSession | null>(null)
  const [exerciseIdx, setExerciseIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('input')
  const [sentence, setSentence] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [feedback, setFeedback] = useState<SentenceFeedback | null>(null)
  const [improvedAudioLoading, setImprovedAudioLoading] = useState(false)
  const [scores, setScores] = useState<number[]>([])

  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSpeechSupported(!!SR)
  }, [router])

  if (!set) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400">סט לא נמצא</p></div>
  }

  const exercise = set.exercises[exerciseIdx]
  const starredWords = exercise.words.filter(w => w.starred).map(w => w.text)
  const allWords = exercise.words.map(w => w.text)
  const isLast = exerciseIdx === set.exercises.length - 1

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'he-IL'
    rec.continuous = false
    rec.interimResults = true
    recognitionRef.current = rec
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      setSentence(t)
    }
    rec.onend = () => setIsListening(false)
    rec.start()
    setIsListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  async function submitSentence() {
    if (!sentence.trim()) return
    setPhase('loading')
    try {
      const res = await fetch('/api/sentence/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: sentence.trim(), starred_words: starredWords, all_words: allWords }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFeedback(data.feedback)
      setScores(prev => [...prev, data.feedback.score])
      setPhase('result')
    } catch {
      alert('שגיאה בעיבוד. נסה שוב.')
      setPhase('input')
    }
  }

  async function playImproved() {
    if (!feedback?.improved_sentence || improvedAudioLoading) return
    setImprovedAudioLoading(true)
    try {
      const res = await fetch('/api/interview/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: feedback.improved_sentence }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (audioRef.current) audioRef.current.pause()
      audioRef.current = new Audio(url)
      audioRef.current.play()
    } finally {
      setImprovedAudioLoading(false)
    }
  }

  function nextExercise() {
    setSentence('')
    setFeedback(null)
    setPhase('input')
    if (isLast) {
      router.push('/sentence')
    } else {
      setExerciseIdx(i => i + 1)
    }
  }

  const scoreColor = (s: number) => s >= 8 ? 'text-green-600' : s >= 6 ? 'text-yellow-600' : 'text-red-500'
  const scoreBg = (s: number) => s >= 8 ? 'bg-green-50 border-green-200' : s >= 6 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mt-4 mb-4">
        <button onClick={() => router.push('/sentence')} className="text-sm text-gray-400 hover:text-gray-600">← חזרה</button>
        <div className="text-center">
          <div className="text-xs font-medium text-gray-500">{set.title}</div>
        </div>
        <div className="text-sm text-gray-500">{exerciseIdx + 1}/{set.exercises.length}</div>
      </div>

      {/* Progress */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
        <div
          className="bg-blue-500 h-1.5 rounded-full transition-all"
          style={{ width: `${((exerciseIdx + (phase === 'result' ? 1 : 0)) / set.exercises.length) * 100}%` }}
        />
      </div>

      {/* ── LOADING ── */}
      {phase === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-64">
          <div className="text-4xl mb-3 animate-bounce">🤔</div>
          <p className="text-gray-500">Gemini בודק את המשפט שלך...</p>
        </div>
      )}

      {/* ── INPUT ── */}
      {phase === 'input' && (
        <>
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-sm text-blue-800">
            <p>השתמש בכל המילים <strong>המסומנות בכוכב ★</strong> ובלפחות <strong>6 מילים</strong> מהרשימה.</p>
          </div>

          {/* Word chips */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">המילים שלך</p>
            <div className="flex flex-wrap gap-2">
              {exercise.words.map((w, i) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition ${
                    w.starred
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {w.starred ? '★ ' : ''}{w.text}
                </span>
              ))}
            </div>
          </div>

          {/* Text input */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">כתוב את המשפט שלך</span>
              {speechSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition ${
                    isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  }`}
                >
                  {isListening ? '⏹ עצור' : '🎤 הקלט'}
                </button>
              )}
            </div>
            <textarea
              value={sentence}
              onChange={e => setSentence(e.target.value)}
              placeholder="כתוב כאן את המשפט שלך בעברית..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-base"
            />
            {isListening && <p className="text-xs text-red-500 mt-1 animate-pulse">🎤 מקליט... דבר בעברית</p>}
          </div>

          <button
            onClick={submitSentence}
            disabled={!sentence.trim()}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-40 text-lg"
          >
            שלח לבדיקה
          </button>
        </>
      )}

      {/* ── RESULT ── */}
      {phase === 'result' && feedback && (
        <>
          {/* Score */}
          <div className={`rounded-2xl border p-5 text-center mb-4 ${scoreBg(feedback.score)}`}>
            <div className={`text-6xl font-bold ${scoreColor(feedback.score)}`}>{feedback.score}</div>
            <div className="text-gray-500 text-sm">מתוך 10</div>
            {!feedback.used_all_starred && feedback.missing_starred.length > 0 && (
              <div className="mt-2 text-red-600 text-sm">
                חסרו מילות חובה: <strong>{feedback.missing_starred.join(', ')}</strong>
              </div>
            )}
            {feedback.used_all_starred && (
              <div className="mt-1 text-green-600 text-xs">✓ כל מילות החובה שומשו</div>
            )}
            <div className="text-gray-400 text-xs mt-1">{feedback.words_used_count} מילים מהרשימה שומשו</div>
          </div>

          {/* Student's sentence */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-3">
            <p className="text-xs text-gray-400 mb-1">המשפט שלך</p>
            <p className="text-gray-800 font-medium leading-relaxed">{sentence}</p>
          </div>

          {/* Feedback */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-3">
            <h3 className="font-semibold text-gray-800 mb-2">💬 משוב</h3>
            <p className="text-gray-700 text-sm leading-relaxed">{feedback.feedback}</p>
          </div>

          {/* Improved sentence */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-green-800">✨ גרסה מושלמת</h3>
              <button
                onClick={playImproved}
                disabled={improvedAudioLoading}
                className="flex items-center gap-1 text-xs bg-white border border-green-300 text-green-700 px-2.5 py-1 rounded-lg hover:bg-green-50 disabled:opacity-50"
              >
                <span>{improvedAudioLoading ? '⏳' : '🔊'}</span>
                <span>{improvedAudioLoading ? 'טוען...' : 'שמע גרסה מושלמת'}</span>
              </button>
            </div>
            <p className="text-green-800 font-medium leading-relaxed mb-2">{feedback.improved_sentence}</p>
            {feedback.improvement_note && (
              <p className="text-green-600 text-xs italic">{feedback.improvement_note}</p>
            )}
          </div>

          <button
            onClick={nextExercise}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition text-lg"
          >
            {isLast ? 'סיים סט' : `תרגיל הבא (${exerciseIdx + 2}/${set.exercises.length})`}
          </button>

          {/* Running average */}
          {scores.length > 0 && (
            <div className="text-center mt-3 text-sm text-gray-400">
              ממוצע עד כה: {(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}/10
            </div>
          )}
        </>
      )}
    </div>
  )
}
