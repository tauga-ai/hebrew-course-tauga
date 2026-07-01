'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { shuffleWithSeed } from '@/lib/shuffle'
import { SIMULATION_INTERVIEW_QUESTIONS } from '@/lib/interview-questions'
import type { SentenceFeedback } from '@/app/api/sentence/feedback/route'
import { useStudentSession } from '@/lib/hooks/use-student-session'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'
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

type Phase = 'intro' | 'starting' | 'a' | 'b' | 'c' | 'd_intro' | 'd' | 'results'

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
  const [sentenceResults, setSentenceResults] = useState<any[]>([])
  const [currentFeedback, setCurrentFeedback] = useState<SentenceFeedback | null>(null)

  // Part D (interview) state
  const [interviewAnswers, setInterviewAnswers] = useState<string[]>([])
  const [interviewCurrentAnswer, setInterviewCurrentAnswer] = useState('')
  const [interviewIdx, setInterviewIdx] = useState(0)
  const [interviewQuestions] = useState(SIMULATION_INTERVIEW_QUESTIONS)
  const [interviewProcessing, setInterviewProcessing] = useState(false)

  // Results
  const [results, setResults] = useState<any>(null)

  const sentenceSpeech = useSpeechToText({ appendMode: true, onTranscript: setSentenceInput })
  const interviewSpeech = useSpeechToText({ appendMode: true, onTranscript: setInterviewCurrentAnswer })

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
    sentenceSpeech.stop()

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
      />
    )
  }

  // ── PHASE: RESULTS ─────────────────────────────────────────────────────────
  if (phase === 'results' && results) {
    return <ResultsPhase session={session} results={results} onBackToMenu={() => router.push('/menu')} />
  }

  return null
}
