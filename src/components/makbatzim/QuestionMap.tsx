interface QuestionMapProps {
  count: number
  currentIndex: number
  /** questionId (1-indexed) -> is_correct, only present for answered questions */
  results: Record<number, boolean>
  onJump: (index: number) => void
}

/** A 1-N numbered grid for jumping between questions, colored by state — gray unanswered, green correct, red incorrect, ring on the current one. */
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
              ? 'bg-red-500 text-white'
              : 'bg-black/5 dark:bg-white/10 text-fg/70 hover:bg-black/10 dark:hover:bg-white/15'
        return (
          <button
            key={questionId}
            onClick={() => onJump(i)}
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
