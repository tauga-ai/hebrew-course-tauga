'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { shuffleWithSeed } from '@/lib/shuffle'
import { SIMULATION_INTERVIEW_QUESTIONS } from '@/lib/interview-questions'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'
import { saveDraft, loadDraft, clearDraft } from '@/lib/draft-storage'
import { ResultsPhase } from './_components/ResultsPhase'
import { SentencePhase } from './_components/SentencePhase'
import { ReadingPhase } from './_components/ReadingPhase'
import { InterviewIntroPhase, InterviewPhase } from './_components/InterviewPhase'

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

export interface SentenceResult {
  ex_order: number
  sentence: string
  score: number
  feedback: string
  improved_sentence: string
}

export interface SimulationResults {
  part_a: { correct: number; total: number; pct: number }
  part_b: { correct: number; total: number; pct: number }
  part_c: { avg: string; results: SentenceResult[] }
  part_d: { score: number; level: string; summary: string }
}

type Phase = 'intro' | 'starting' | 'a' | 'b' | 'c' | 'd_intro' | 'd' | 'results'

interface SimulationDraft {
  simSessionId: string
  phase: Phase
  partA: SimQuestion[]
  partB: SimQuestion[]
  partC: SimExercise[]
  currentQ: number
  readingAnswers: Record<number, number>
  currentEx: number
  sentenceInput: string
  sentenceResults: SentenceResult[]
  interviewIdx: number
  interviewAnswers: string[]
  interviewCurrentAnswer: string
}

const draftKey = (studentId: string) => `simulation_draft_${studentId}`

const STEPS = [
  { label: 'חלק א', desc: '16 שאלות קשות', icon: '📖' },
  { label: 'חלק ב', desc: '24 שאלות קשות מאוד', icon: '📚' },
  { label: 'חלק ג', desc: '5 תרגילי משפט', icon: '✍️' },
  { label: 'חלק ד', desc: 'ראיון אישי', icon: '🎤' },
]

export default function SimulationPage() {
  const router = useRouter()
  const { session } = useStudentSession()
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
  const [evalLoading, setEvalLoading] = useState(false)
  const [sentenceResults, setSentenceResults] = useState<SentenceResult[]>([])
  const [currentFeedback, setCurrentFeedback] = useState<SentenceFeedback | null>(null)

  // Part D (interview) state
  const [interviewAnswers, setInterviewAnswers] = useState<string[]>([])
  const [interviewCurrentAnswer, setInterviewCurrentAnswer] = useState('')
  const [interviewIdx, setInterviewIdx] = useState(0)
  const [interviewQuestions] = useState(SIMULATION_INTERVIEW_QUESTIONS)
  const [interviewProcessing, setInterviewProcessing] = useState(false)

  // Results
  const [results, setResults] = useState<SimulationResults | null>(null)

  // Submit-in-flight / failure state, shared across finishPartA/finishPartB/nextSentence
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Refresh-resistance: an in-progress draft found in localStorage on mount, offered as a resume prompt.
  const [pendingDraft, setPendingDraft] = useState<SimulationDraft | null>(null)

  const sentenceSpeech = useSpeechToText({ appendMode: true, onTranscript: setSentenceInput })
  const interviewSpeech = useSpeechToText({ appendMode: true, onTranscript: setInterviewCurrentAnswer })

  // Check once for a saved draft as soon as we know who the student is.
  useEffect(() => {
    if (!session) return
    function checkForDraft() {
      const draft = loadDraft<SimulationDraft>(draftKey(session!.id))
      if (draft && draft.phase !== 'intro' && draft.phase !== 'starting' && draft.phase !== 'results') {
        setPendingDraft(draft)
      }
    }
    checkForDraft()
  }, [session])

  // Auto-save progress while a simulation is actually in flight.
  useEffect(() => {
    if (!session) return
    if (phase === 'intro' || phase === 'starting' || phase === 'results') return
    const draft: SimulationDraft = {
      simSessionId, phase, partA, partB, partC,
      currentQ, readingAnswers, currentEx, sentenceInput, sentenceResults,
      interviewIdx, interviewAnswers, interviewCurrentAnswer,
    }
    saveDraft(draftKey(session.id), draft)
  }, [session, phase, simSessionId, partA, partB, partC, currentQ, readingAnswers,
      currentEx, sentenceInput, sentenceResults, interviewIdx, interviewAnswers, interviewCurrentAnswer])

  // Warn before leaving mid-simulation — progress is saved, but a fresh tab loses submission state.
  useEffect(() => {
    if (phase === 'intro' || phase === 'starting' || phase === 'results') return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [phase])

  function resumeDraft() {
    if (!pendingDraft) return
    const d = pendingDraft
    setSimSessionId(d.simSessionId)
    setPartA(d.partA)
    setPartB(d.partB)
    setPartC(d.partC)
    setCurrentQ(d.currentQ)
    setReadingAnswers(d.readingAnswers)
    setCurrentEx(d.currentEx)
    setSentenceInput(d.sentenceInput)
    setSentenceResults(d.sentenceResults)
    setInterviewIdx(d.interviewIdx)
    setInterviewAnswers(d.interviewAnswers)
    setInterviewCurrentAnswer(d.interviewCurrentAnswer)
    setPhase(d.phase)
    setPendingDraft(null)
  }

  function discardDraftAndStartOver() {
    if (session) clearDraft(draftKey(session.id))
    setPendingDraft(null)
  }

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
    const res = await fetch('/api/simulation/start', { method: 'POST' })
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
    const res = await fetch('/api/simulation/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: simSessionId, type, answers }),
    })
    if (!res.ok) throw new Error(`submitReading(${type}) failed`)
  }

  async function finishPartA() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitReading('reading_a', partA)
      setCurrentQ(0)
      setPhase('b')
    } catch {
      setSubmitError('שגיאה בשמירת התשובות. בדוק חיבור לאינטרנט ונסה שוב.')
    } finally {
      setSubmitting(false)
    }
  }

  async function finishPartB() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitReading('reading_b', partB)
      setCurrentEx(0)
      setSentenceInput('')
      setSentenceResults([])
      setCurrentFeedback(null)
      setPhase('c')
    } catch {
      setSubmitError('שגיאה בשמירת התשובות. בדוק חיבור לאינטרנט ונסה שוב.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── SENTENCES (Part C) ─────────────────────────────────────────────────────

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

  async function submitSentenceResults(resultsToSubmit: typeof sentenceResults) {
    const res = await fetch('/api/simulation/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: simSessionId, type: 'sentences', results: resultsToSubmit }),
    })
    if (!res.ok) throw new Error('submitSentenceResults failed')
  }

  async function nextSentence() {
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
    sentenceSpeech.stop()

    if (currentEx + 1 >= partC.length) {
      setSubmitting(true)
      setSubmitError(null)
      try {
        await submitSentenceResults(newResults)
        setPhase('d_intro')
      } catch {
        setSubmitError('שגיאה בשמירת התוצאות. בדוק חיבור לאינטרנט ונסה שוב.')
      } finally {
        setSubmitting(false)
      }
    } else {
      setCurrentEx(i => i + 1)
    }
  }

  async function retrySentenceSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitSentenceResults(sentenceResults)
      setPhase('d_intro')
    } catch {
      setSubmitError('שגיאה בשמירת התוצאות. בדוק חיבור לאינטרנט ונסה שוב.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── INTERVIEW (Part D) ─────────────────────────────────────────────────────

  function startInterview() {
    setInterviewIdx(0)
    setInterviewAnswers([])
    setInterviewCurrentAnswer('')
    setPhase('d')
  }

  function interviewNextQuestion() {
    interviewSpeech.stop()
    const newAnswers = [...interviewAnswers, interviewCurrentAnswer]
    setInterviewAnswers(newAnswers)
    setInterviewCurrentAnswer('')           // safe — recognition is blocked

    if (interviewIdx + 1 >= interviewQuestions.length) {
      finishInterview(newAnswers)
    } else {
      setInterviewIdx(i => i + 1)
    }
  }

  async function finishInterview(allAnswers: string[]) {
    setInterviewProcessing(true)
    setSubmitError(null)
    try {
      const qa_pairs = interviewQuestions.map((q, i) => ({ question: q, answer: allAnswers[i] || '' }))
      const res = await fetch('/api/interview/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: session?.full_name, qa_pairs }),
      })
      if (!res.ok) throw new Error('interview feedback failed')
      const data = await res.json()
      const fb = data.feedback
      if (!fb) throw new Error('interview feedback missing')

      const submitRes = await fetch('/api/simulation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: simSessionId, type: 'interview',
          score: fb.score, level: fb.level, summary: fb.summary,
        }),
      })
      if (!submitRes.ok) throw new Error('interview submit failed')

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
      if (session) clearDraft(draftKey(session.id))
      setPhase('results')
    } catch {
      setSubmitError('שגיאה בקבלת המשוב על הראיון. בדוק חיבור לאינטרנט ונסה שוב.')
    } finally {
      setInterviewProcessing(false)
    }
  }

  // ── RENDER HELPERS ─────────────────────────────────────────────────────────

  const progressBar = (current: number) => (
    <div className="flex gap-1 mb-6">
      {STEPS.map((s, i) => (
        <div key={i} className={`flex-1 h-1.5 rounded-full ${i < current ? 'bg-primary-500' : i === current ? 'bg-primary-300' : 'bg-gray-200 dark:bg-white/10'}`} />
      ))}
    </div>
  )

  const stepHeader = (step: number) => (
    <div className="flex justify-between items-center mt-4 mb-2">
      <span className="text-sm text-fg/40">{STEPS[step].icon} {STEPS[step].label}: {STEPS[step].desc}</span>
    </div>
  )

  const errorBanner = (onRetry: () => void) => submitError && (
    <div className="bg-red-50 border border-red-200 dark:bg-red-950/40 dark:border-red-800 rounded-xl p-3 mb-4 text-sm text-red-700 dark:text-red-400 flex items-center justify-between gap-3">
      <span>{submitError}</span>
      <button onClick={onRetry} disabled={submitting} className="text-red-700 dark:text-red-400 font-semibold underline flex-shrink-0 disabled:opacity-40">נסה שוב</button>
    </div>
  )

  // ── PHASE: INTRO ───────────────────────────────────────────────────────────
  if (phase === 'intro' && pendingDraft) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">⏸️</div>
        <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mb-2">נמצאה סימולציה פעילה</h1>
        <p className="text-fg/70 mb-6 text-sm leading-relaxed">
          נראה שהתחלת סימולציה ולא סיימת אותה. אפשר להמשיך מאיפה שעצרת, או להתחיל מחדש.
        </p>
        <button onClick={resumeDraft}
          className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 transition text-lg mb-3">
          המשך מאיפה שעצרתי
        </button>
        <button onClick={discardDraftAndStartOver}
          className="w-full border border-card-border text-fg/70 font-semibold py-3 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition">
          התחל מחדש
        </button>
      </div>
    </div>
  )

  if (phase === 'intro') return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl shadow-md max-w-md w-full p-8 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h1 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mb-2">סימולציה אמיתית</h1>
        <p className="text-fg/60 mb-1 text-sm">שלום, <strong>{session?.full_name}</strong></p>
        <p className="text-fg/70 mb-6 text-sm leading-relaxed">
          סימולציה מקיפה בת 4 חלקים המדמה תנאי בחינה אמיתיים.
        </p>
        <div className="bg-black/5 dark:bg-white/5 rounded-xl p-4 mb-6 text-right space-y-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className="text-lg">{s.icon}</span>
              <span><strong>{s.label}:</strong> {s.desc}</span>
            </div>
          ))}
        </div>
        <div className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-950/40 dark:border-yellow-800 rounded-xl p-3 mb-6 text-xs text-yellow-800 dark:text-yellow-400 text-right">
          ⚠️ לאחר התחלה לא ניתן לחזור אחורה. ודא שיש לך זמן מספיק לסיים.
        </div>
        <button onClick={startSimulation}
          className="w-full bg-primary-600 text-white font-semibold py-3 rounded-xl hover:bg-primary-700 transition text-lg">
          התחל סימולציה
        </button>
        <button onClick={() => router.push('/menu')} className="mt-3 text-sm text-fg/40 hover:text-fg/70">חזרה</button>
      </div>
    </div>
  )

  // ── PHASE: STARTING ────────────────────────────────────────────────────────
  if (phase === 'starting') return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-5xl animate-bounce">📋</div>
      <p className="text-fg/70 font-medium">טוען את הסימולציה...</p>
    </div>
  )

  // ── PHASE: PART A ──────────────────────────────────────────────────────────
  if (phase === 'a') {
    return (
      <ReadingPhase
        stepHeader={stepHeader(0)}
        progressBar={progressBar(0)}
        keyPrefix="a"
        questions={partA}
        currentQ={currentQ}
        setCurrentQ={setCurrentQ}
        readingAnswers={readingAnswers}
        setReadingAnswers={setReadingAnswers}
        getShuffledOptions={getShuffledOptions}
        groupByPassage={false}
        showUnansweredWarning={true}
        finishLabel="סיים חלק א →"
        onFinish={finishPartA}
        submitting={submitting}
        errorBanner={errorBanner(finishPartA)}
      />
    )
  }

  // ── PHASE: PART B ──────────────────────────────────────────────────────────
  if (phase === 'b') {
    return (
      <ReadingPhase
        stepHeader={stepHeader(1)}
        progressBar={progressBar(1)}
        keyPrefix="b"
        questions={partB}
        currentQ={currentQ}
        setCurrentQ={setCurrentQ}
        readingAnswers={readingAnswers}
        setReadingAnswers={setReadingAnswers}
        getShuffledOptions={getShuffledOptions}
        groupByPassage={true}
        showUnansweredWarning={false}
        finishLabel="סיים חלק ב →"
        onFinish={finishPartB}
        submitting={submitting}
        errorBanner={errorBanner(finishPartB)}
      />
    )
  }

  // ── PHASE: PART C ──────────────────────────────────────────────────────────
  if (phase === 'c') {
    return (
      <SentencePhase
        stepHeader={stepHeader(2)}
        progressBar={progressBar(2)}
        partC={partC}
        currentEx={currentEx}
        sentenceInput={sentenceInput}
        setSentenceInput={setSentenceInput}
        evalLoading={evalLoading}
        currentFeedback={currentFeedback}
        sentenceSpeech={sentenceSpeech}
        onSubmitSentence={submitSentence}
        onNextSentence={nextSentence}
        submitting={submitting}
        errorBanner={errorBanner(retrySentenceSubmit)}
      />
    )
  }

  // ── PHASE: PART D INTRO ────────────────────────────────────────────────────
  if (phase === 'd_intro') {
    return <InterviewIntroPhase questionCount={interviewQuestions.length} onStart={startInterview} />
  }

  // ── PHASE: PART D (INTERVIEW) ──────────────────────────────────────────────
  if (phase === 'd') {
    return (
      <InterviewPhase
        stepHeader={stepHeader(3)}
        progressBar={progressBar(3)}
        processing={interviewProcessing}
        questions={interviewQuestions}
        currentIdx={interviewIdx}
        currentAnswer={interviewCurrentAnswer}
        setCurrentAnswer={setInterviewCurrentAnswer}
        interviewSpeech={interviewSpeech}
        onNextQuestion={interviewNextQuestion}
        errorBanner={errorBanner(() => finishInterview(interviewAnswers))}
      />
    )
  }

  // ── PHASE: RESULTS ─────────────────────────────────────────────────────────
  if (phase === 'results' && results) {
    return <ResultsPhase session={session} results={results} onBackToMenu={() => router.push('/menu')} />
  }

  return null
}
