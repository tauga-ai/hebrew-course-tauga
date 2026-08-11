import { t } from '@/lib/dev-i18n'

interface QuestionMapProps {
  count: number
  currentIndex: number
  /** questionId (1-indexed) -> is_correct, or 'answered' for a question that's
   * been answered but not yet revealed (exam mode) — anything else is unanswered. */
  results: Record<number, boolean | 'answered'>
  onJump: (index: number) => void
}

/** A 1-N numbered grid for jumping between questions, colored by state — gray unanswered, neutral answered-not-revealed, green correct, red incorrect, ring on the current one. */
export function QuestionMap({ count, currentIndex, results, onJump }: QuestionMapProps) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {Array.from({ length: count }, (_, i) => {
        const questionId = i + 1
        const result = results[questionId]
        const stateClass =
          result === true
            ? 'bg-green-500 text-white'
            : result === false
              // underline is a non-color cue distinguishing "incorrect" from
              // "correct" for colorblind users, who can't rely on red vs. green.
              ? 'bg-red-500 text-white underline decoration-2 underline-offset-2'
              : result === 'answered'
                ? 'bg-accent-makbatzim text-white'
                : 'bg-black/5 dark:bg-white/10 text-fg/70 hover:bg-black/10 dark:hover:bg-white/15'
        const stateLabel = result === true ? t(', נענתה נכון') : result === false ? t(', נענתה שגוי') : result === 'answered' ? t(', נענתה') : ''
        return (
          <button
            key={questionId}
            onClick={() => onJump(i)}
            aria-label={`${t('שאלה')} ${questionId}${stateLabel}`}
            className={`aspect-square rounded text-xs font-medium transition ${stateClass} ${
              i === currentIndex ? 'ring-2 ring-offset-1 ring-accent-makbatzim' : ''
            }`}
          >
            {questionId}
          </button>
        )
      })}
    </div>
  )
}
