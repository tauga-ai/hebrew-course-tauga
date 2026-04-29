'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AIWordList } from '@/app/api/ai-practice/sentence-words/route'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import type { StudentSession } from '@/lib/types'
import { speakHebrew } from '@/lib/use-hebrew-tts'

const LEVEL_LABELS: Record<number, string> = {
  1: 'מילון יומיומי בסיסי — בית, משפחה, בית ספר',
  2: 'פעולות ומצבים — עבודה, נסיעה, קנייה',
  3: 'נושאים מגוונים — ספורט, מוזיקה, טיול',
  4: 'אוצר מילים מתקדם — טכנולוגיה, חברה, מדע',
  5: 'מושגים אקדמיים — ניתוח, השוואה, מסקנות',
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'border-green-300 bg-green-50 text-green-700',
  2: 'border-blue-300 bg-blue-50 text-blue-700',
  3: 'border-yellow-300 bg-yellow-50 text-yellow-700',
  4: 'border-orange-300 bg-orange-50 text-orange-700',
  5: 'border-red-300 bg-red-50 text-red-700',
}

type Phase = 'pick' | 'gen-loading' | 'input' | 'eval-loading' | 'result'

export default function AISentencePage() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [level, setLevel] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [wordList, setWordList] = useState<AIWordList | null>(null)
  const [sentence, setSentence] = useState('')
  const [feedback, setFeedback] = useState<SentenceFeedback | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [scores, setScores] = useState<number[]>([])
  const [error, setError] = useState('')

  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const baseTextRef = useRef('')

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSpeechSupported(!!SR)
  }, [router])

  async function generateExercise(lvl: number) {
    setLevel(lvl)
    setPhase('gen-loading')
    setSentence('')
    setFeedback(null)
    setError('')
    try {
      const res = await fetch('/api/ai-practice/sentence-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: lvl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setWordList(data.wordList)
      setPhase('input')
    } catch {
      setError('שגיאה ביצירת התרגיל. נסה שוב.')
      setPhase('pick')
    }
  }

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    baseTextRef.current = sentence.trim()
    const rec = new SR()
    rec.lang = 'he-IL'
    rec.continuous = true
    rec.interimResults = true
    recognitionRef.current = rec
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      const base = baseTextRef.current
      setSentence(base ? base + ' ' + t : t)
    }
    rec.onerror = () => setIsListening(false)
    rec.onend = () => setIsListening(false)
    rec.start()
    setIsListening(true)
  }

  function stopListening() { recognitionRef.current?.stop(); setIsListening(false) }

  async function submitSentence() {
    if (!sentence.trim() || !wordList) return
    setPhase('eval-loading')
    const starred = wordList.words.filter(w => w.starred).map(w => w.text)
    const all = wordList.words.map(w => w.text)
    try {
      const res = await fetch('/api/sentence/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: sentence.trim(), starred_words: starred, all_words: all }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setFeedback(data.feedback)
      setScores(s => [...s, data.feedback.score])
      setPhase('result')
    } catch {
      alert('שגיאה בבדיקת המשפט. נסה שוב.')
      setPhase('input')
    }
  }

  async function playImproved() {
    if (!feedback?.improved_sentence || ttsLoading) return
    setTtsLoading(true)
    try {
      await speakHebrew(feedback.improved_sentence)
    } finally { setTtsLoading(false) }
  }

  const scoreColor = (s: number) => s >= 8 ? 'text-green-600' : s >= 6 ? 'text-yellow-600' : 'text-red-500'
  const scoreBg   = (s: number) => s >= 8 ? 'bg-green-50 border-green-200' : s >= 6 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mt-4 mb-6">
        <button onClick={() => router.push('/menu')} className="text-sm text-gray-400 hover:text-gray-600">← תפריט</button>
        <div className="text-center">
          <h1 className="font-bold text-purple-700">בניית משפטים עם AI</h1>
          {level && <div className="text-xs text-gray-500">רמה {level}</div>}
        </div>
        {scores.length > 0 ? (
          <div className="text-sm text-gray-500">{(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)}/10</div>
        ) : <div />}
      </div>

      {/* ── PICK LEVEL ── */}
      {phase === 'pick' && (
        <>
          <p className="text-center text-gray-500 text-sm mb-6">בחר רמה וה-AI יצור לך תרגיל בניית משפט</p>
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map(lvl => (
              <button key={lvl} onClick={() => generateExercise(lvl)}
                className={`w-full text-right rounded-2xl border-2 p-4 transition hover:shadow-md ${LEVEL_COLORS[lvl]}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold">רמה {lvl}</div>
                    <div className="text-xs mt-0.5 opacity-80">{LEVEL_LABELS[lvl]}</div>
                  </div>
                  <span className="text-lg">←</span>
                </div>
              </button>
            ))}
          </div>
          {error && <p className="text-red-500 text-sm text-center mt-4">{error}</p>}
          {scores.length > 0 && (
            <div className="mt-6 bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-600">
              ממוצע כולל: {(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)}/10 ({scores.length} תרגילים)
            </div>
          )}
        </>
      )}

      {/* ── GENERATING ── */}
      {phase === 'gen-loading' && (
        <div className="flex flex-col items-center justify-center min-h-64 gap-4">
          <div className="text-4xl animate-spin">🤖</div>
          <p className="text-gray-500">יוצר תרגיל ברמה {level}...</p>
        </div>
      )}

      {/* ── INPUT ── */}
      {phase === 'input' && wordList && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800">
            <p>השתמש בכל המילים <strong>★ המסומנות בכחול</strong> ובלפחות <strong>6 מילים</strong> מהרשימה.</p>
            <p className="text-xs text-blue-600 mt-0.5">נושא: {wordList.theme}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase mb-3">המילים שלך</p>
            <div className="flex flex-wrap gap-2">
              {wordList.words.map((w, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                  w.starred ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-gray-100 text-gray-700 border-gray-200'
                }`}>
                  {w.starred ? '★ ' : ''}{w.text}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-gray-700">המשפט שלך</span>
              <div className="flex gap-2">
                {sentence && (
                  <button onClick={() => { stopListening(); setSentence('') }}
                    className="text-xs text-gray-400 hover:text-red-500 px-2 py-1 rounded">נקה</button>
                )}
                {speechSupported && (
                  <button onClick={isListening ? stopListening : startListening}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition ${
                      isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}>
                    {isListening ? '⏹ עצור' : '🎤 הקלט את עצמך'}
                  </button>
                )}
              </div>
            </div>
            <textarea value={sentence} onChange={e => setSentence(e.target.value)}
              placeholder="כתוב כאן את המשפט שלך בעברית, או הקלט את עצמך..."
              rows={4} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-800 text-base"
            />
            {isListening && <p className="text-xs text-red-500 mt-1.5 animate-pulse">🎤 מקליט... לחץ ״עצור״ כשתסיים.</p>}
          </div>

          <button onClick={submitSentence} disabled={!sentence.trim()}
            className="w-full bg-purple-600 text-white font-semibold py-3.5 rounded-xl hover:bg-purple-700 transition disabled:opacity-40 text-lg">
            שלח לבדיקה
          </button>
        </>
      )}

      {/* ── EVALUATING ── */}
      {phase === 'eval-loading' && (
        <div className="flex flex-col items-center justify-center min-h-64 gap-4">
          <div className="text-4xl animate-bounce">🤔</div>
          <p className="text-gray-500">בודק את המשפט שלך...</p>
        </div>
      )}

      {/* ── RESULT ── */}
      {phase === 'result' && feedback && (
        <>
          <div className={`rounded-2xl border p-5 text-center mb-4 ${scoreBg(feedback.score)}`}>
            <div className={`text-6xl font-bold ${scoreColor(feedback.score)}`}>{feedback.score}</div>
            <div className="text-gray-500 text-sm">מתוך 10</div>
            <div className="mt-2 text-xs text-gray-500">
              {feedback.used_all_starred
                ? <span className="text-green-600">✓ כל מילות החובה שומשו</span>
                : <span className="text-red-500">✗ חסרו: {feedback.missing_starred.join(', ')}</span>}
              <span className="mr-2">&bull; {feedback.words_used_count} מילים שומשו</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
            <p className="text-xs text-gray-400 mb-1">המשפט שלך</p>
            <p className="text-gray-800 leading-relaxed">{sentence}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-3">
            <h3 className="font-semibold text-gray-800 mb-2">💬 משוב</h3>
            <p className="text-gray-700 text-sm leading-relaxed">{feedback.feedback}</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-green-800">✨ גרסה מושלמת</h3>
              <button onClick={playImproved} disabled={ttsLoading}
                className="flex items-center gap-1 text-xs bg-white border border-green-300 text-green-700 px-2.5 py-1.5 rounded-lg hover:bg-green-50 disabled:opacity-50 font-medium">
                <span>{ttsLoading ? '⏳' : '🔊'}</span>
                <span>{ttsLoading ? 'טוען...' : 'האזן לגרסה המושלמת'}</span>
              </button>
            </div>
            <p className="text-green-900 font-medium leading-relaxed mb-2">{feedback.improved_sentence}</p>
            {feedback.improvement_note && (
              <p className="text-green-700 text-xs border-t border-green-200 pt-2 mt-2">{feedback.improvement_note}</p>
            )}
          </div>

          <button onClick={() => { setPhase('pick'); setWordList(null); setSentence(''); setFeedback(null) }}
            className="w-full bg-purple-600 text-white font-semibold py-3.5 rounded-xl hover:bg-purple-700 transition text-lg mb-2">
            צור תרגיל נוסף
          </button>
          <button onClick={() => generateExercise(level!)}
            className="w-full text-sm text-purple-500 hover:text-purple-700 py-2">
            תרגיל נוסף באותה רמה ({level})
          </button>
        </>
      )}
    </div>
  )
}
