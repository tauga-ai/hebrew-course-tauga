'use client'

import { useState } from 'react'
import type { AIWordList } from '@/app/api/ai-practice/sentence-words/route'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import { speakHebrew } from '@/lib/tts-client'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'
import { PageHeader } from '@/components/PageHeader'
import { StudentSidebar } from '@/components/layout/StudentSidebar'
import { scoreColor as sharedScoreColor } from '@/lib/score-color'

const LEVEL_LABELS: Record<number, string> = {
  1: 'מילון יומיומי בסיסי: בית, משפחה, בית ספר',
  2: 'פעולות ומצבים: עבודה, נסיעה, קנייה',
  3: 'נושאים מגוונים: ספורט, מוזיקה, טיול',
  4: 'אוצר מילים מתקדם: טכנולוגיה, חברה, מדע',
  5: 'מושגים אקדמיים: ניתוח, השוואה, מסקנות',
}

const LEVEL_COLORS: Record<number, string> = {
  1: 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400',
  2: 'border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-500/10 dark:text-primary-400',
  3: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400',
  4: 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-400',
  5: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400',
}

type Phase = 'pick' | 'gen-loading' | 'input' | 'eval-loading' | 'result'

export default function AISentencePage() {
  useStudentSession() // guards this page; redirects unauthenticated users
  const [level, setLevel] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('pick')
  const [wordList, setWordList] = useState<AIWordList | null>(null)
  const [sentence, setSentence] = useState('')
  const [feedback, setFeedback] = useState<SentenceFeedback | null>(null)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [scores, setScores] = useState<number[]>([])
  const [error, setError] = useState('')

  const { isListening, start: startListening, stop: stopListening, supported: speechSupported } = useSpeechToText({
    appendMode: true,
    onTranscript: setSentence,
  })

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
      if (level !== null) {
        fetch('/api/ai-practice/sentence/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, score: data.feedback.score }),
        }).catch(() => {})
      }
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

  const THRESHOLDS = { good: 8, ok: 6 }
  const scoreColor = (s: number) => sharedScoreColor(s, { thresholds: THRESHOLDS })
  const scoreBg = (s: number) => sharedScoreColor(s, {
    thresholds: THRESHOLDS,
    palette: {
      good: 'bg-green-50 border-green-200 dark:bg-green-950/40 dark:border-green-800',
      ok: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800',
      bad: 'bg-red-50 border-red-200 dark:bg-red-950/40 dark:border-red-800',
    },
  })

  return (
    <div className="min-h-screen md:flex">
      <StudentSidebar />
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
      <PageHeader
        backHref="/menu"
        backLabel="← תפריט"
        title="בניית משפטים עם AI"
        titleColorClass="text-purple-700 dark:text-purple-400"
        subtitle={level ? `רמה ${level}` : undefined}
        right={scores.length > 0 ? `${(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)}/10` : undefined}
      />

      {/* ── PICK LEVEL ── */}
      {phase === 'pick' && (
        <>
          <p className="text-center text-fg/60 text-sm mb-6">בחר רמה וה-AI יצור לך תרגיל בניית משפט</p>
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
          {error && <p className="text-red-500 dark:text-red-400 text-sm text-center mt-4">{error}</p>}
          {scores.length > 0 && (
            <div className="mt-6 bg-black/5 dark:bg-white/5 rounded-xl p-4 text-center text-sm text-fg/70">
              ממוצע כולל: {(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1)}/10 ({scores.length} תרגילים)
            </div>
          )}
        </>
      )}

      {/* ── GENERATING ── */}
      {phase === 'gen-loading' && (
        <div className="flex flex-col items-center justify-center min-h-64 gap-4">
          <div className="text-4xl animate-spin">🤖</div>
          <p className="text-fg/60">יוצר תרגיל ברמה {level}...</p>
        </div>
      )}

      {/* ── INPUT ── */}
      {phase === 'input' && wordList && (
        <>
          <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-800 rounded-xl p-3 mb-4 text-sm text-primary-800 dark:text-primary-300">
            <p>השתמש בכל המילים <strong>★ המסומנות בכחול</strong> ובלפחות <strong>6 מילים</strong> מהרשימה.</p>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">נושא: {wordList.theme}</p>
          </div>

          <div className="bg-surface rounded-2xl border border-card-border p-5 mb-4">
            <p className="text-xs font-semibold text-fg/40 uppercase mb-3">המילים שלך</p>
            <div className="flex flex-wrap gap-2">
              {wordList.words.map((w, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                  w.starred ? 'bg-primary-600 text-white border-primary-600 shadow-sm' : 'bg-black/5 dark:bg-white/5 text-fg/80 border-card-border'
                }`}>
                  {w.starred ? '★ ' : ''}{w.text}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-card-border p-5 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-fg/80">המשפט שלך</span>
              <div className="flex gap-2">
                {sentence && (
                  <button onClick={() => { stopListening(); setSentence('') }}
                    className="text-xs text-fg/40 hover:text-red-500 px-2 py-1 rounded">נקה</button>
                )}
                {speechSupported && (
                  <button onClick={() => isListening ? stopListening() : startListening(sentence)}
                    className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg font-medium transition ${
                      isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-primary-100 dark:bg-primary-500/10 text-primary-700 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-500/20'
                    }`}>
                    {isListening ? '⏹ עצור' : '🎤 הקלט את עצמך'}
                  </button>
                )}
              </div>
            </div>
            <textarea value={sentence} onChange={e => setSentence(e.target.value)}
              placeholder="כתוב כאן את המשפט שלך בעברית, או הקלט את עצמך..."
              rows={4} className="w-full border border-card-border rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-purple-400 bg-surface text-fg text-base"
            />
            {isListening && <p className="text-xs text-red-500 dark:text-red-400 mt-1.5 animate-pulse">🎤 מקליט... לחץ ״עצור״ כשתסיים.</p>}
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
          <p className="text-fg/60">בודק את המשפט שלך...</p>
        </div>
      )}

      {/* ── RESULT ── */}
      {phase === 'result' && feedback && (
        <>
          <div className={`rounded-2xl border p-5 text-center mb-4 ${scoreBg(feedback.score)}`}>
            <div className={`text-6xl font-bold ${scoreColor(feedback.score)}`}>{feedback.score}</div>
            <div className="text-fg/60 text-sm">מתוך 10</div>
            <div className="mt-2 text-xs text-fg/60">
              {feedback.used_all_starred
                ? <span className="text-green-600 dark:text-green-400">✓ כל מילות החובה שומשו</span>
                : <span className="text-red-500 dark:text-red-400">✗ חסרו: {feedback.missing_starred.join(', ')}</span>}
              <span className="mr-2">&bull; {feedback.words_used_count} מילים שומשו</span>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-card-border p-4 mb-3">
            <p className="text-xs text-fg/40 mb-1">המשפט שלך</p>
            <p className="text-fg leading-relaxed">{sentence}</p>
          </div>

          <div className="bg-surface rounded-2xl border border-card-border p-5 mb-3">
            <h3 className="font-semibold text-fg mb-2">💬 משוב</h3>
            <p className="text-fg/80 text-sm leading-relaxed">{feedback.feedback}</p>
          </div>

          <div className="bg-green-50 border border-green-200 dark:bg-green-950/40 dark:border-green-800 rounded-2xl p-5 mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-green-800 dark:text-green-300">✨ גרסה מושלמת</h3>
              <button onClick={playImproved} disabled={ttsLoading}
                className="flex items-center gap-1 text-xs bg-surface border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 px-2.5 py-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-500/10 disabled:opacity-50 font-medium">
                <span>{ttsLoading ? '⏳' : '🔊'}</span>
                <span>{ttsLoading ? 'טוען...' : 'האזן לגרסה המושלמת'}</span>
              </button>
            </div>
            <p className="text-green-900 dark:text-green-300 font-medium leading-relaxed mb-2">{feedback.improved_sentence}</p>
            {feedback.improvement_note && (
              <p className="text-green-700 dark:text-green-400 text-xs border-t border-green-200 dark:border-green-800 pt-2 mt-2">{feedback.improvement_note}</p>
            )}
          </div>

          <button onClick={() => { setPhase('pick'); setWordList(null); setSentence(''); setFeedback(null) }}
            className="w-full bg-purple-600 text-white font-semibold py-3.5 rounded-xl hover:bg-purple-700 transition text-lg mb-2">
            צור תרגיל נוסף
          </button>
          <button onClick={() => generateExercise(level!)}
            className="w-full text-sm text-purple-500 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 py-2">
            תרגיל נוסף באותה רמה ({level})
          </button>
        </>
      )}
      </div>
    </div>
  )
}
