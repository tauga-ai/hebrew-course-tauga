/** Small filled/unfilled dot row — level N out of 5, or all-unfilled when locked. */
export function LevelSteps({ level, locked }: { level: number; locked?: boolean }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${!locked && i < level ? 'bg-accent-naale' : 'bg-gray-200 dark:bg-white/10'}`}
        />
      ))}
    </span>
  )
}
