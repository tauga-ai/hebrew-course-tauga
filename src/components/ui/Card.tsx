import type { ReactNode } from 'react'

/**
 * One entry per practice-module accent already registered in globals.css's
 * @theme block. Written out as full literal class strings (not built via
 * template interpolation) so Tailwind's scanner can find them — a
 * dynamically-constructed class name like `bg-accent-${key}` would not be
 * detected at build time.
 */
const ACCENT_STYLES = {
  dapar: { badge: 'bg-accent-dapar/10 text-accent-dapar', hoverBorder: 'hover:border-accent-dapar' },
  simulation: { badge: 'bg-accent-simulation/10 text-accent-simulation', hoverBorder: 'hover:border-accent-simulation' },
  interview: { badge: 'bg-accent-interview/10 text-accent-interview', hoverBorder: 'hover:border-accent-interview' },
  sentence: { badge: 'bg-accent-sentence/10 text-accent-sentence', hoverBorder: 'hover:border-accent-sentence' },
  psychotechnic: { badge: 'bg-accent-psychotechnic/10 text-accent-psychotechnic', hoverBorder: 'hover:border-accent-psychotechnic' },
  'ai-reading': { badge: 'bg-accent-ai-reading/10 text-accent-ai-reading', hoverBorder: 'hover:border-accent-ai-reading' },
  'ai-sentence': { badge: 'bg-accent-ai-sentence/10 text-accent-ai-sentence', hoverBorder: 'hover:border-accent-ai-sentence' },
  'tzav-rishon': { badge: 'bg-accent-tzav-rishon/10 text-accent-tzav-rishon-fg', hoverBorder: 'hover:border-accent-tzav-rishon' },
  reading: { badge: 'bg-primary-600/10 text-primary-700 dark:text-primary-400', hoverBorder: 'hover:border-primary-400' },
  makbatzim: { badge: 'bg-accent-makbatzim/10 text-accent-makbatzim', hoverBorder: 'hover:border-accent-makbatzim' },
} as const

export type AccentColor = keyof typeof ACCENT_STYLES

interface CardProps {
  icon?: string
  title: string
  subtitle?: string
  accentColor: AccentColor
  trailing?: ReactNode
  onClick?: () => void
  disabled?: boolean
}

/**
 * The one card shape used everywhere in the student hub — same rounding,
 * padding, min-height and hover treatment regardless of what it represents
 * (a whole practice module or a single reading-comprehension set). Category
 * identity comes only from the small accent-colored icon badge, not from
 * filling the whole card, so nothing in a grid of these ever looks like it
 * belongs to a different design language.
 */
export function Card({ icon, title, subtitle, accentColor, trailing, onClick, disabled }: CardProps) {
  const accent = ACCENT_STYLES[accentColor]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`w-full h-full min-h-[92px] text-right bg-surface border border-card-border rounded-xl p-4 flex items-center gap-3 transition ${
        disabled ? 'cursor-default' : `hover:shadow-sm ${accent.hoverBorder} cursor-pointer`
      }`}
    >
      {icon && (
        <span className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl ${accent.badge}`}>
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block font-semibold text-fg truncate">{title}</span>
        {subtitle && <span className="block text-xs text-fg/60 mt-0.5 truncate">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  )
}
