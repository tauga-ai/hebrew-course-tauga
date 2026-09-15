'use client'

import { useState, useSyncExternalStore } from 'react'
import { t, debugMode } from '@/lib/dev-i18n'
import { getShowHint, subscribeShowHint } from '@/lib/dev-hint'
import { useSpeechToText } from '@/lib/hooks/use-speech-to-text'
import { OpenAnswerInput } from '@/components/naale/OpenAnswerInput'
import { SpeechToTextToggle } from '@/components/naale/SpeechToTextToggle'

// No word limit in the spec (unlike every other AI-graded topic) — a large,
// effectively-unenforced ceiling reuses OpenAnswerInput's existing word
// counter/limit UI rather than forking a second input component for the one
// difference of "no real cap".
const EFFECTIVELY_UNLIMITED_WORDS = 500

// Same weak-answer string every other open topic's dev sample uses
// (open-exercise-display.ts) — unrelated to any prompt, should reliably
// score 1-2 regardless of which question or turn this fills.
const WEAK_SAMPLE_ANSWER = 'חתול. שולחן. אתמול היה.'

/**
 * Dev-only QA aid, same convention as OPEN_EXERCISE_DISPLAY's
 * devSampleAnswers (open-exercise-display.ts) — lets someone testing without
 * reading Hebrew fill a plausible answer instead of composing one. Generic
 * on purpose, same reasoning as Story Continuation's goodContinuationClause:
 * expected_answer_rubric (the only thing that could make this row-specific,
 * e.g. a forced side) is grading-only and never reaches the client, so this
 * can't tailor itself to it — it just weaves in the first recommended
 * connector, which is enough to read as a real, well-reasoned opinion.
 */
function goodSampleAnswer(requiredConnectors: string): string {
  const firstConnector = requiredConnectors.split(/[,،]/)[0]?.trim()
  const connectorClause = firstConnector ? `${firstConnector}, ` : ''
  return `לדעתי זו העמדה הנכונה. ${connectorClause}יש לכך היגיון ברור ויתרונות משמעותיים, ולכן אני תומך בגישה הזו.`
}

interface DebateExchangeProps {
  initialAiLine: string
  requiredConnectors: string
  submitting: boolean
  submitLabel?: string
  /** Posts one turn to the server. Returns { awaiting_final: true, ai_response }
   *  when a counter-argument comes back (levels 4-5's first reply) — the
   *  component shows it and waits for a second submission. Returns null once
   *  the exchange is finished (score arrived) or the request otherwise ended
   *  the flow (expired/duplicate/error) — the parent already handled that
   *  case (setting its own result state, ending the session, etc.), so this
   *  component has nothing further to do. */
  onSubmit: (userText: string) => Promise<{ awaiting_final: true; ai_response: string } | null>
}

/**
 * The debate topic's conversational UI — owns the evolving AI line and the
 * student's current turn's text, for up to two turns before a score exists.
 * Unlike every other topic, the "question" isn't static: it's whatever the
 * AI last said, so this renders both the prompt and the input together
 * rather than splitting them across the page's usual top/bottom areas (see
 * session/page.tsx's q.kind === 'conversation' handling).
 *
 * Must be remounted per question (key={q.id} at the call site) — its
 * internal aiLine/text state is only ever updated locally after a submit,
 * never re-derived from props, so a new question needs a fresh instance.
 */
export function DebateExchange({ initialAiLine, requiredConnectors, submitting, submitLabel, onSubmit }: DebateExchangeProps) {
  const [aiLine, setAiLine] = useState(initialAiLine)
  const [text, setText] = useState('')
  const [validationError, setValidationError] = useState('')
  const [speechError, setSpeechError] = useState(false)
  const showHint = useSyncExternalStore(subscribeShowHint, getShowHint, getShowHint)

  const { isListening, start: startListening, stop: stopListening, supported: speechSupported } = useSpeechToText({
    continuous: false,
    onTranscript: newText => { setText(newText); if (validationError) setValidationError('') },
    onError: () => setSpeechError(true),
  })

  async function handleSubmit() {
    if (!text.trim()) {
      setValidationError(t('אנא הקלד או הקלט את תגובתך לפני ההגשה'))
      return
    }
    const result = await onSubmit(text)
    if (result?.awaiting_final) {
      setAiLine(result.ai_response)
      setText('')
      setValidationError('')
    }
  }

  return (
    <div>
      <p className="text-fg font-medium text-lg mb-3 text-right whitespace-pre-line">{aiLine}</p>
      {requiredConnectors && (
        <div className="inline-block rounded-full bg-accent-naale/10 text-accent-naale text-sm font-semibold px-3 py-1 mb-4">
          {t('מילות קישור מומלצות')}: {requiredConnectors}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-fg/80">{t('התשובה שלי')}</label>
        <SpeechToTextToggle
          isListening={isListening}
          supported={speechSupported}
          onToggle={() => {
            if (isListening) {
              stopListening()
            } else {
              setSpeechError(false)
              startListening()
            }
          }}
        />
      </div>
      {isListening && (
        <p className="text-xs text-red-500 dark:text-red-400 mb-1 animate-pulse text-right">{t('🎤 מקליט... דבר בעברית')}</p>
      )}
      {!isListening && (speechError || !speechSupported) && (
        <p className="text-xs text-fg/60 mb-1 text-right">
          {speechError ? t('לא הצלחנו לשמוע, אנא נסה שוב או השתמש בהקלדה') : t('ההקלטה הקולית לא זמינה בדפדפן הזה. אפשר להקליד את התשובה במקום.')}
        </p>
      )}

      <OpenAnswerInput
        value={text}
        onChange={newText => { setText(newText); if (validationError) setValidationError('') }}
        onSubmit={handleSubmit}
        wordLimit={EFFECTIVELY_UNLIMITED_WORDS}
        loading={submitting}
        submitLabel={submitLabel}
      />
      {validationError && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400 text-right">{validationError}</p>
      )}

      {/* QA-only: same visibility rule as every other AI-graded topic's dev
          sample-answer buttons (debugMode && showHint) — lets someone
          testing without reading Hebrew fill a plausible answer instead of
          composing one. Never shown to a real student. */}
      {debugMode && showHint && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => { setText(goodSampleAnswer(requiredConnectors)); setValidationError('') }}
            className="text-xs px-2 py-1 rounded-lg border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
          >
            💡 QA: fill good answer
          </button>
          <button
            type="button"
            onClick={() => { setText(WEAK_SAMPLE_ANSWER); setValidationError('') }}
            className="text-xs px-2 py-1 rounded-lg border border-amber-400 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
          >
            💡 QA: fill weak answer
          </button>
        </div>
      )}
    </div>
  )
}
