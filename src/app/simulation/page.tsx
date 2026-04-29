'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StudentSession } from '@/lib/types'
import { shuffleWithSeed } from '@/lib/shuffle'

// Part A/B question type from DB
interface SimQuestion {
  id: number; part: number; q_order: number
  passage_text: string; question_text: string
  option_1: string; option_2: string; option_3: string; option_4: string
  correct_answer: number
}
interface SimExercise {
  id: number; ex_order: number
  words_json: { text: string; starred: boolean }[]
}

type Phase = 'intro' | 'starting' | 'a' | 'b' | 'c' | 'd_intro' | 'd' | 'results'

const STEPS = [
  { label: 'חלק א', desc: '16 שאלות קשות', icon: '📖' },
  { label: 'חלק ב', desc: '24 שאלות קשות מאוד', icon: '📚' },
  { label: 'חלק ג', desc: '5 תרגילי משפט', icon: '✍️' },
  { label: 'חלק ד', desc: 'ראיון אישי', icon: '🎤' },
]
const HEBREW = ['א', 'ב', 'ג', 'ד']

export default function SimulationPage() {
  const router = useRouter()
  const [session, setSession] = useState<StudentSession | null>(null)
  const [simSessionId, setSimSessionId] = useState('')
  const [phase, setPhase] = useState<Phase>('intro')

  // Content
  const [partA, setPartA] = useState<SimQuestion[]>([])
  const [partB, setPartB] = useState<SimQuestion[]>([])
  const [partC, setPartC] = useState<SimExercise[]>([])

  // Part A/B state
  const [currentQ, setCurrentQ] = useState(0)
  const [readingAnswers, setReadingAnswers] = useState<Record<number, number>>({}) // questionId → selected

  // Part C state
  const [currentEx, setCurrentEx] = useState(0)
  const [sentenceInput, setSentenceInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [evalLoading, setEvalLoading] = useState(false)
  const [sentenceResults, setSentenceResults] = useState<any[]>([])
  const [currentFeedback, setCurrentFeedback] = useState<any>(null)

  // Part D (interview) state
  const [interviewAnswers, setInterviewAnswers] = useState<string[]>([])
  const [interviewCurrentAnswer, setInterviewCurrentAnswer] = useState('')
  const [interviewIdx, setInterviewIdx] = useState(0)
  const [interviewQuestions] = useState([
    'איך קוראים לך?', 'מאיפה אתה? (מה הכפר/העיר שנולדת בה?)', 'איפה אתה גר היום?',
    'בן כמה אתה?', 'איך העברית שלך?', 'אתה מדבר עברית בבית?',
    'מה אתה רוצה לעשות בצבא?', 'למה אתה רוצה את התפקיד הזה?',
    'אתה מוכן לשירות צבאי?', 'מה לדעתך האתגר הכי גדול שלך בעברית?',
    'ספר לי על המשפחה שלך', 'איך הולך לך בלימודים?',
    'מה אתה עושה בזמן הפנוי?', 'יש לך חברים שמדברים עברית?',
    'איפה למדת עברית?', 'מה לדעתך חשוב יותר — לעבוד קשה או להיות מוכשר?',
  ])
  const [interviewProcessing, setInterviewProcessing] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const baseTextRef = useRef('')

  // Results
  const [results, setResults] = useState<any>(null)

  useEffect(() => {
    const raw = localStorage.getItem('student_session')
    if (!raw) { router.replace('/student'); return }
    setSession(JSON.parse(raw))
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSpeechSupported(!!SR)
  }, [router])

  // ── HELPERS ────────────────────────────────────────────────────────────────

  function getShuffledOptions(q: SimQuestion): { num: number; text: string }[] {
    const opts = [
      { num: 1, text: q.option_1 }, { num: 2, text: q.option_2 },
      { num: 3, text: q.option_3 }, { num: 4, text: q.option_4 },
    ]
    const order = shuffleWithSeed([0,1,2,3], q.id)
    return order.map(i => opts[i])
  }

  async function startSimulation() {
    if (!session) return
    setPhase('starting')
    const res = await fetch('/api/simulation/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: session.id, class_id: session.class_id }),
    })
    const data = await res.json()
    setSimSessionId(data.session_id)
    setPartA(data.part_a)
    setPartB(data.part_b)
    setPartC(data.part_c)
    setCurrentQ(0)
    setReadingAnswers({})
    setPhase('a')
  }

  // ── READING (Part A & B) ───────────────────────────────────────────────────

  async function submitReading(type: 'reading_a' | 'reading_b', questions: SimQuestion[]) {
    const answers = questions.map(q => ({
      question_id: q.id,
      selected_answer: readingAnswers[q.id] || 0,
      is_correct: readingAnswers[q.id] === q.correct_answer,
    }))
    await fetch('/api/simulation/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: simSessionId, type, answers }),
    })
  }

  function finishPartA() {
    submitReading('reading_a', partA)
    setCurrentQ(0)
    setPhase('b')
  }

  function finishPartB() {
    submitReading('reading_b', partB)
    setCurrentEx(0)
    setSentenceInput('')
    setSentenceResults([])
    setCurrentFeedback(null)
    setPhase('c')
  }

  // ── SENTENCES (Part C) ─────────────────────────────────────────────────────

  function startListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    baseTextRef.current = sentenceInput.trim()
    const rec = new SR()
    rec.lang = 'he-IL'; rec.continuous = true; rec.interimResults = true
    recognitionRef.current = rec
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      setSentenceInput(baseTextRef.current ? baseTextRef.current + ' ' + t : t)
    }
    rec.onerror = () => setIsListening(false)
    rec.onend = () => setIsListening(false)
    rec.start(); setIsListening(true)
  }
  function stopListening() { recognitionRef.current?.stop(); setIsListening(false) }

  async function submitSentence() {
    const ex = partC[currentEx]
    if (!sentenceInput.trim() || !ex) return
    setEvalLoading(true)
    const starred = ex.words_json.filter(w => w.starred).map(w => w.text)
    const all = ex.words_json.map(w => w.text)
    const res = await fetch('/api/sentence/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sentence: sentenceInput.trim(), starred_words: starred, all_words: all }),
    })
    const data = await res.json()
    setCurrentFeedback(data.feedback)
    setEvalLoading(false)
  }

  function nextSentence() {
    const ex = partC[currentEx]
    const newResult = {
      ex_order: ex.ex_order,
      sentence: sentenceInput.trim(),
      score: currentFeedback?.score || 0,
      feedback: currentFeedback?.feedback || '',
      improved_sentence: currentFeedback?.improved_sentence || '',
    }
    const newResults = [...sentenceResults, newResult]
    setSentenceResults(newResults)
    setSentenceInput('')
    setCurrentFeedback(null)
    stopListening()

    if (currentEx + 1 >= partC.length) {
      // Submit all sentence results and move to interview
      fetch('/api/simulation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: simSessionId, type: 'sentences', results: newResults }),
      })
      setPhase('d_intro')
    } else {
      setCurrentEx(i => i + 1)
    }
  }

  // ── INTERVIEW (Part D) ─────────────────────────────────────────────────────

  function startInterview() {
    setInterviewIdx(0)
    setInterviewAnswers([])
    setInterviewCurrentAnswer('')
    setPhase('d')
  }

  function interviewStartListening() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    baseTextRef.current = interviewCurrentAnswer.trim()
    const rec = new SR()
    rec.lang = 'he-IL'; rec.continuous = true; rec.interimResults = true
    recognitionRef.current = rec
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      setInterviewCurrentAnswer(baseTextRef.current ? baseTextRef.current + ' ' + t : t)
    }
    rec.onerror = () => setIsListening(false)
    rec.onend = () => setIsListening(false)
    rec.start(); setIsListening(true)
  }

  function interviewNextQuestion() {
    stopListening()
    const newAnswers = [...interviewAnswers, interviewCurrentAnswer]
    setInterviewAnswers(newAnswers)
    setInterviewCurrentAnswer('')

    if (interviewIdx + 1 >= interviewQuestions.length) {
      finishInterview(newAnswers)
    } else {
      setInterviewIdx(i => i + 1)
    }
  }

  async function finishInterview(allAnswers: string[]) {
    setInterviewProcessing(true)
    const qa_pairs = interviewQuestions.map((q, i) => ({ question: q, answer: allAnswers[i] || '' }))
    const res = await fetch('/api/interview/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_name: session?.full_name, qa_pairs }),
    })
    const data = await res.json()
    const fb = data.feedback

    await fetch('/api/simulation/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: simSessionId, type: 'interview',
        score: fb.score, level: fb.level, summary: fb.summary,
      }),
    })

    // Compute results
    const aCorrect = partA.filter(q => readingAnswers[q.id] === q.correct_answer).length
    const bCorrect = partB.filter(q => readingAnswers[q.id] === q.correct_answer).length
    const cAvg = sentenceResults.length > 0
      ? sentenceResults.reduce((s, r) => s + r.score, 0) / sentenceResults.length : 0

    setResults({
      part_a: { correct: aCorrect, total: partA.length, pct: Math.round((aCorrect / partA.length) * 100) },
      part_b: { correct: bCorrect, total: partB.length, pct: Math.round((bCorrect / partB.length) * 100) },
      part_c: { avg: cAvg.toFixed(1), results: sentenceResults },
      part_d: { score: fb.score, level: fb.level, summary: fb.summary },
    })
    setInterviewProcessing(false)
    setPhase('results')
  }

  // ── RENDER HELPERS ─────────────────────────────────────────────────────────

  const progressBar = (current: number) => (
    <div className="flex gap-1 mb-6">
      {STEPS.map((s, i) => (
        <div key={i} className={`flex-1 h-1.5 rounded-full ${i < current ? 'bg-blue-500' : i === current ? 'bg-blue-300' : 'bg-gray-200'}`} />
      ))}
    </div>
  )

  const stepHeader = (step: number) => (
    <div className="flex justify-between items-center mt-4 mb-2">
      <span className="text-sm text-gray-400">{STEPS[step].icon} {STEPS[step].label} — {STEPS[step].desc}</span>
    </div>
  )

  // ── PHASE: INTRO ───────────────────────────────────────────────────────────
  if (phase === 'intro') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h1 className="text-2xl font-bold text-blue-700 mb-2">סימולציה אמיתית</h1>
        <p className="text-gray-500 mb-1 text-sm">שלום, <strong>{session?.full_name}</strong></p>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          סימולציה מקיפה בת 4 חלקים המדמה תנאי בחינה אמיתיים.
        </p>
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-right space-y-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-lg">{s.icon}</span>
              <span><strong>{s.label}:</strong> {s.desc}</span>
            </div>
          ))}
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-6 text-xs text-yellow-800 text-right">
          ⚠️ לאחר התחלה לא ניתן לחזור אחורה. ודא שיש לך זמן מספיק לסיים.
        </div>
        <button onClick={startSimulation}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition text-lg">
          התחל סימולציה
        </button>
        <button onClick={() => router.push('/menu')} className="mt-3 text-sm text-gray-400 hover:text-gray-600">חזרה</button>
      </div>
    </div>
  )

  // ── PHASE: STARTING ────────────────────────────────────────────────────────
  if (phase === 'starting') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl animate-bounce">📋</div>
      <p className="text-gray-600 font-medium">טוען את הסימולציה...</p>
    </div>
  )

  // ── PHASE: PART A ──────────────────────────────────────────────────────────
  if (phase === 'a') {
    const q = partA[currentQ]
    const opts = q ? getShuffledOptions(q) : []
    const answered = partA.filter(q => readingAnswers[q.id] !== undefined).length
    return (
      <div className="min-h-screen p-4 max-w-2xl mx-auto">
        {stepHeader(0)}
        {progressBar(0)}
        <div className="flex justify-between text-sm text-gray-500 mb-4">
          <span>שאלה {currentQ + 1} / {partA.length}</span>
          <span>{answered} נענו</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <p className="text-gray-700 leading-relaxed text-sm mb-3 pb-3 border-b border-gray-100 whitespace-pre-line">{q?.passage_text}</p>
          <p className="text-gray-800 font-semibold leading-relaxed">{q?.question_text}</p>
        </div>
        <div key={`a-${q?.id}`} className="space-y-3 mb-4">
          {opts.map((opt, i) => {
            const sel = readingAnswers[q?.id] === opt.num
            return (
              <button key={`${q?.id}-${opt.num}`}
                onClick={() => setReadingAnswers(prev => ({ ...prev, [q.id]: opt.num }))}
                className={`w-full text-right rounded-xl border p-3.5 transition flex items-center gap-3 ${sel ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${sel ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{HEBREW[i]}</span>
                <span className="text-sm">{opt.text}</span>
              </button>
            )
          })}
        </div>
        <div className="flex justify-between">
          <button onClick={() => setCurrentQ(i => Math.max(0, i-1))} disabled={currentQ === 0}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50">← הקודמת</button>
          {currentQ < partA.length - 1
            ? <button onClick={() => setCurrentQ(i => i+1)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">הבאה →</button>
            : <button onClick={finishPartA} disabled={answered < partA.length}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-blue-700">סיים חלק א →</button>
          }
        </div>
        {answered < partA.length && currentQ === partA.length - 1 && (
          <p className="text-orange-500 text-xs text-center mt-2">עדיין חסרות {partA.length - answered} תשובות</p>
        )}
      </div>
    )
  }

  // ── PHASE: PART B ──────────────────────────────────────────────────────────
  if (phase === 'b') {
    const q = partB[currentQ]
    const opts = q ? getShuffledOptions(q) : []
    const answered = partB.filter(q => readingAnswers[q.id] !== undefined).length
    const isNewPassage = currentQ === 0 || partB[currentQ]?.passage_text !== partB[currentQ-1]?.passage_text
    return (
      <div className="min-h-screen p-4 max-w-2xl mx-auto">
        {stepHeader(1)}
        {progressBar(1)}
        <div className="flex justify-between text-sm text-gray-500 mb-4">
          <span>שאלה {currentQ + 1} / {partB.length}</span>
          <span>{answered} נענו</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          {isNewPassage && <p className="text-gray-700 leading-relaxed text-sm mb-3 pb-3 border-b border-gray-100 whitespace-pre-line">{q?.passage_text}</p>}
          {!isNewPassage && <p className="text-xs text-gray-400 mb-2 italic">(אותו קטע)</p>}
          <p className="text-gray-800 font-semibold leading-relaxed">{q?.question_text}</p>
        </div>
        <div key={`b-${q?.id}`} className="space-y-3 mb-4">
          {opts.map((opt, i) => {
            const sel = readingAnswers[q?.id] === opt.num
            return (
              <button key={`${q?.id}-${opt.num}`}
                onClick={() => setReadingAnswers(prev => ({ ...prev, [q.id]: opt.num }))}
                className={`w-full text-right rounded-xl border p-3.5 transition flex items-center gap-3 ${sel ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-200 hover:border-blue-300'}`}>
                <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${sel ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{HEBREW[i]}</span>
                <span className="text-sm">{opt.text}</span>
              </button>
            )
          })}
        </div>
        <div className="flex justify-between">
          <button onClick={() => setCurrentQ(i => Math.max(0, i-1))} disabled={currentQ === 0}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-30 hover:bg-gray-50">← הקודמת</button>
          {currentQ < partB.length - 1
            ? <button onClick={() => setCurrentQ(i => i+1)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">הבאה →</button>
            : <button onClick={finishPartB} disabled={answered < partB.length}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-40 hover:bg-blue-700">סיים חלק ב →</button>
          }
        </div>
      </div>
    )
  }

  // ── PHASE: PART C ──────────────────────────────────────────────────────────
  if (phase === 'c') {
    const ex = partC[currentEx]
    const words = ex?.words_json || []
    return (
      <div className="min-h-screen p-4 max-w-2xl mx-auto">
        {stepHeader(2)}
        {progressBar(2)}
        <div className="text-sm text-gray-500 mb-4">תרגיל {currentEx + 1} / {partC.length}</div>

        {!currentFeedback ? (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800">
              השתמש בכל המילים <strong>★ המסומנות בכחול</strong> ובלפחות 6 מילים מהרשימה.
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <div className="flex flex-wrap gap-2">
                {words.map((w, i) => (
                  <span key={i} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${w.starred ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                    {w.starred ? '★ ' : ''}{w.text}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-medium text-gray-700">המשפט שלי</span>
                <div className="flex gap-2">
                  {sentenceInput && <button onClick={() => setSentenceInput('')} className="text-xs text-gray-400 hover:text-red-400 px-2 py-1">נקה</button>}
                  {speechSupported && (
                    <button onClick={isListening ? stopListening : startListening}
                      className={`text-sm px-3 py-1.5 rounded-lg font-medium ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                      {isListening ? '⏹ עצור' : '🎤 הקלט את עצמך'}
                    </button>
                  )}
                </div>
              </div>
              <textarea value={sentenceInput} onChange={e => setSentenceInput(e.target.value)}
                placeholder="כתוב את המשפט שלך כאן..." rows={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800" />
            </div>
            <button onClick={submitSentence} disabled={!sentenceInput.trim() || evalLoading}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition">
              {evalLoading ? 'בודק...' : 'שלח לבדיקה'}
            </button>
          </>
        ) : (
          <>
            <div className={`rounded-2xl border p-4 text-center mb-3 ${currentFeedback.score >= 7 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className={`text-4xl font-bold ${currentFeedback.score >= 7 ? 'text-green-600' : 'text-yellow-600'}`}>{currentFeedback.score}/10</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
              <p className="text-xs text-gray-400 mb-1">המשפט שלך</p>
              <p className="text-gray-800 text-sm">{sentenceInput}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
              <p className="text-sm text-gray-700">{currentFeedback.feedback}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
              <p className="text-xs text-green-600 font-semibold mb-1">✨ גרסה מושלמת</p>
              <p className="text-green-800 text-sm font-medium">{currentFeedback.improved_sentence}</p>
            </div>
            <button onClick={nextSentence}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition">
              {currentEx + 1 >= partC.length ? 'עבור לראיון →' : `תרגיל הבא (${currentEx + 2}/${partC.length}) →`}
            </button>
          </>
        )}
      </div>
    )
  }

  // ── PHASE: PART D INTRO ────────────────────────────────────────────────────
  if (phase === 'd_intro') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">🎤</div>
        <h2 className="text-xl font-bold text-blue-700 mb-2">חלק ד — ראיון אישי</h2>
        <p className="text-gray-600 mb-6 text-sm">
          תענה על {interviewQuestions.length} שאלות ראיון. תוכל לכתוב או להקליט את עצמך.
          בסוף תקבל ציון ופידבק.
        </p>
        <button onClick={startInterview}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition">
          התחל ראיון
        </button>
      </div>
    </div>
  )

  // ── PHASE: PART D (INTERVIEW) ──────────────────────────────────────────────
  if (phase === 'd') {
    if (interviewProcessing) return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <div className="text-5xl animate-bounce">🤖</div>
        <p className="text-gray-500">מנתח את הראיון ומכין פידבק...</p>
        <div className="flex gap-2">{[0,1,2].map(i=><div key={i} className="w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
      </div>
    )
    const q = interviewQuestions[interviewIdx]
    return (
      <div className="min-h-screen p-4 max-w-2xl mx-auto">
        {stepHeader(3)}
        {progressBar(3)}
        <div className="flex justify-between text-sm text-gray-500 mb-4">
          <span>שאלה {interviewIdx + 1} / {interviewQuestions.length}</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-4">
          <p className="text-xl font-semibold text-gray-800 leading-relaxed">{q}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-700">תשובתי</span>
            {speechSupported && (
              <button onClick={isListening ? stopListening : interviewStartListening}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                {isListening ? '⏹ עצור' : '🎤 הקלט את עצמך'}
              </button>
            )}
          </div>
          <textarea value={interviewCurrentAnswer} onChange={e => setInterviewCurrentAnswer(e.target.value)}
            placeholder="כתוב את תשובתך כאן..." rows={5}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800" />
        </div>
        <button onClick={interviewNextQuestion}
          className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-700 transition text-lg">
          {interviewIdx + 1 === interviewQuestions.length ? 'סיים וקבל פידבק' : `שאלה הבאה (${interviewIdx + 2}/${interviewQuestions.length})`}
        </button>
        <button onClick={interviewNextQuestion} className="w-full mt-2 text-xs text-gray-400 hover:text-gray-500 py-1">דלג</button>
      </div>
    )
  }

  // ── PHASE: RESULTS ─────────────────────────────────────────────────────────
  if (phase === 'results' && results) {
    const readingTotal = results.part_a.total + results.part_b.total
    const readingCorrect = results.part_a.correct + results.part_b.correct
    const readingPct = Math.round((readingCorrect / readingTotal) * 100)

    return (
      <div className="min-h-screen p-4 max-w-2xl mx-auto pb-12">
        <div className="text-center mt-6 mb-6">
          <div className="text-5xl mb-2">🏆</div>
          <h1 className="text-2xl font-bold text-blue-700">סיימת את הסימולציה!</h1>
          <p className="text-gray-500 text-sm">{session?.full_name}</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-blue-700">{readingPct}%</div>
            <div className="text-xs text-blue-600 mt-1">הבנת הנקרא (א+ב)<br/>{readingCorrect}/{readingTotal}</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-purple-700">{results.part_c.avg}/10</div>
            <div className="text-xs text-purple-600 mt-1">בניית משפטים (ממוצע)</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-green-700">{results.part_a.pct}%</div>
            <div className="text-xs text-green-600 mt-1">חלק א — שאלות קשות<br/>{results.part_a.correct}/{results.part_a.total}</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
            <div className="text-3xl font-bold text-orange-700">{results.part_b.pct}%</div>
            <div className="text-xs text-orange-600 mt-1">חלק ב — שאלות קשות מאוד<br/>{results.part_b.correct}/{results.part_b.total}</div>
          </div>
        </div>

        {/* Interview score */}
        <div className={`rounded-2xl border p-4 text-center mb-5 ${results.part_d.score >= 70 ? 'bg-green-50 border-green-200' : results.part_d.score >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`text-4xl font-bold ${results.part_d.score >= 70 ? 'text-green-600' : results.part_d.score >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>{results.part_d.score}/100</div>
          <div className="text-sm text-gray-600 mt-1">ראיון אישי — {results.part_d.level}</div>
          <p className="text-gray-600 text-sm mt-2 leading-relaxed">{results.part_d.summary}</p>
        </div>

        <button onClick={() => router.push('/menu')}
          className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition">
          חזור לתפריט
        </button>
      </div>
    )
  }

  return null
}
