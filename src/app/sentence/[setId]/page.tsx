'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { SENTENCE_SETS } from '@/lib/sentence-exercises'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import { speakHebrew } from '@/lib/use-hebrew-tts'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'
import { PageHeader } from '@/components/PageHeader'

type Phase = 'input' | 'loading' | 'result'

export default function SentenceSetPage() {
  const router = useRouter()
  const params = useParams()
  const setId = Number(params.setId)
  const set = SENTENCE_SETS.find(s => s.id === setId)

  const { session } = useStudentSession()
  const [exerciseIdx, setExerciseIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('input')
  const [sentence, setSentence] = useState('')
  const [feedback, setFeedback] = useState<SentenceFeedback | null>(null)
  const [ttsError, setTtsError] = useState('')
  const [improvedAudioLoading, setImprovedAudioLoading] = useState(false)
  const [scores, setScores] = useState<number[]>([])

  const { isListening, start: startListening, stop: stopListening, supported: speechSupported } = useSpeechToText({
    appendMode: true,
    onTranscript: setSentence,
  })

  if (!set) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-400">סט לא נמצא</p>
    </div>
  )

  const exercise = set.exercises[exerciseIdx]
  const starredWords = exercise.words.filter(w => w.starred).map(w => w.text)
  const allWords = exercise.words.map(w => w.text)
  const isLast = exerciseIdx === set.exercises.length - 1

  async function submitSentence() {
    if (!sentence.trim()) return
    setPhase('loading')
    setTtsError('')
    try {
      const res = await fetch('/api/sentence/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: sentence.trim(),
          starred_words: starredWords,
          all_words: allWords,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFeedback(data.feedback)
      setScores(prev => [...prev, data.feedback.score])
      setPhase('result')
      // Save to DB (fire-and-forget)
      if (session) {
        fetch('/api/sentence/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ set_id: setId, exercise_idx: exerciseIdx, score: data.feedback.score }),
        }).catch(() => {})
      }
    } catch {
      alert('שגיאה בקבלת המשוב. נסה שוב.')
      setPhase('input')
    }
  }

  async function playImproved() {
    if (!feedback?.improved_sentence || improvedAudioLoading) return
    setImprovedAudioLoading(true)
    setTtsError('')
    try {
      await speakHebrew(feedback.improved_sentence)
    } catch {
      setTtsError('לא ניתן להשמיע כעת.')
    } finally {
      setImprovedAudioLoading(false)
    }
  }

  function nextExercise() {
    setSentence('')
    setFeedback(null)
    setTtsError('')
    setPhase('input')
    if (isLast) {
      router.push('/sentence')
    } else {
      setExerciseIdx(i => i + 1)
    }
  }

  const scoreColor = (s: number) => s >= 8 ? 'text-green-600' : s >= 6 ? 'text-yellow-600' : 'text-red-500'
  const scoreBg   = (s: number) => s >= 8 ? 'bg-green-50 border-green-200' : s >= 6 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'
  const scoreLabel = (s: number) => s >= 9 ? 'מצוין!' : s >= 7 ? 'טוב מאוד' : s >= 5 ? 'סביר' : 'צריך שיפור'

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <PageHeader backHref="/sentence" subtitle={set.title} right={`${exerciseIdx + 1}/${set.exercises.length}`} />

      {/* Progress */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-6">
        <div
          className="bg-primary-500 h-1.5 rounded-full transition-all"
          style={{ width: `${((exerciseIdx + (phase === 'result' ? 1 : 0)) / set.exercises.length) * 100}%` }}
        />
      </div>

      {/* ── LOADING ── */}
      {phase === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-64 gap-4">
          <div className="text-4xl animate-bounce">🤔</div>
          <p className="text-gray-500">בודק את המשפט שלך...</p>
          <div className="flex gap-2">
            {[0,1,2].map(i => (
              <div key={i} className="w-2.5 h-2.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── INPUT ── */}
      {phase === 'input' && (
        <>
          {/* Rules reminder */}
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 mb-4 text-sm text-primary-800">
            <p>
              השתמש בכל המילים <strong>המסומנות בכוכב ★</strong> (חובה)
              ובלפחות <strong>6 מילים</strong> מהרשימה הכללית.
            </p>
            <p className="text-primary-600 text-xs mt-1">
              💡 צורות שונות של מילה נספרות — למשל ״חברים״ וגם ״חבריי״
            </p>
          </div>

          {/* Word chips */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">המילים שלך</p>
            <div className="flex flex-wrap gap-2">
              {exercise.words.map((w, i) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                    w.starred
                      ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                >
                  {w.starred ? '★ ' : ''}{w.text}
                </span>
              ))}
            </div>
          </div>

          {/* Input area */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">המשפט שלך</span>
              <div className="flex gap-2">
                {sentence && (
                  <button
                    onClick={() => { stopListening(); setSentence('') }}
                    className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded"
                  >
                    נקה
                  </button>
                )}
                {speechSupported && (
                  <button
                    onClick={() => isListening ? stopListening() : startListening(sentence)}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                    }`}
                  >
                    {isListening ? '⏹ עצור' : '🎤 הקלט'}
                  </button>
                )}
              </div>
            </div>
            <textarea
              value={sentence}
              onChange={e => setSentence(e.target.value)}
              placeholder="כתוב כאן את המשפט שלך בעברית, או לחץ על 🎤..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 text-gray-800 text-base"
            />
            {isListening && (
              <p className="text-xs text-red-500 mt-1.5 animate-pulse">
                🎤 מקליט... דבר בעברית. לחץ ״עצור״ כשתסיים.
              </p>
            )}
            {speechSupported && !isListening && sentence && (
              <p className="text-xs text-gray-400 mt-1.5">
                💡 לחץ שוב על 🎤 כדי להוסיף עוד דיבור לטקסט
              </p>
            )}
          </div>

          <button
            onClick={submitSentence}
            disabled={!sentence.trim()}
            className="w-full bg-primary-600 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-700 transition disabled:opacity-40 text-lg"
          >
            שלח לבדיקה
          </button>
        </>
      )}

      {/* ── RESULT ── */}
      {phase === 'result' && feedback && (
        <>
          {/* Score card */}
          <div className={`rounded-2xl border p-5 text-center mb-4 ${scoreBg(feedback.score)}`}>
            <div className={`text-6xl font-bold ${scoreColor(feedback.score)}`}>{feedback.score}</div>
            <div className="text-gray-500 text-sm">מתוך 10</div>
            <div className={`text-lg font-semibold mt-1 ${scoreColor(feedback.score)}`}>
              {scoreLabel(feedback.score)}
            </div>
            <div className="mt-2 text-xs text-gray-500 space-y-0.5">
              {feedback.used_all_starred
                ? <p className="text-green-600">✓ כל מילות החובה שומשו</p>
                : <p className="text-red-500">✗ חסרו מילות חובה: <strong>{feedback.missing_starred.join(', ')}</strong></p>
              }
              <p>{feedback.words_used_count} מילים מהרשימה שומשו</p>
              {feedback.score <= 8 && feedback.score >= 7 && feedback.used_all_starred && (
                <p className="text-yellow-600 text-xs mt-1">(-{10 - feedback.score} על דקדוק/ניסוח)</p>
              )}
            </div>
          </div>

          {/* Your sentence */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
            <p className="text-xs text-gray-400 mb-1">המשפט שכתבת</p>
            <p className="text-gray-800 leading-relaxed">{sentence}</p>
          </div>

          {/* Feedback */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-3">
            <h3 className="font-semibold text-gray-800 mb-2">💬 משוב</h3>
            <p className="text-gray-700 text-sm leading-relaxed">{feedback.feedback}</p>
          </div>

          {/* Improved sentence */}
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-green-800">✨ גרסה מושלמת</h3>
              <button
                onClick={playImproved}
                disabled={improvedAudioLoading}
                className="flex items-center gap-1 text-xs bg-white border border-green-300 text-green-700 px-2.5 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50 font-medium"
              >
                <span>{improvedAudioLoading ? '⏳' : '🔊'}</span>
                <span>{improvedAudioLoading ? 'טוען...' : 'האזן לגרסה המושלמת'}</span>
              </button>
            </div>
            <p className="text-green-900 font-medium leading-relaxed mb-2">{feedback.improved_sentence}</p>
            {feedback.improvement_note && (
              <p className="text-green-700 text-xs border-t border-green-200 pt-2 mt-2">{feedback.improvement_note}</p>
            )}
            {ttsError && (
              <p className="text-red-500 text-xs mt-2">{ttsError}</p>
            )}
          </div>

          <button
            onClick={nextExercise}
            className="w-full bg-primary-600 text-white font-semibold py-3.5 rounded-xl hover:bg-primary-700 transition text-lg"
          >
            {isLast ? 'סיים סט' : `תרגיל הבא (${exerciseIdx + 2}/${set.exercises.length})`}
          </button>

          {scores.length > 0 && (
            <p className="text-center mt-3 text-sm text-gray-400">
              ממוצע עד כה: {(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)}/10
            </p>
          )}
        </>
      )}
    </div>
  )
}
