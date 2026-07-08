'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

interface NavItem {
  href: string
  icon: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dapar', icon: '📝', label: 'סימולציית דפ"ר' },
  { href: '/simulation', icon: '🏆', label: 'סימולציה אמיתית' },
  { href: '/interview', icon: '🗣️', label: 'ראיון אישי' },
  { href: '/sentence', icon: '✍️', label: 'בניית משפטים' },
  { href: '/psychotechnic', icon: '🧠', label: 'פסיכוטכני' },
  { href: '/tzav-rishon', icon: '🎯', label: 'דפ"ר לצו ראשון' },
  { href: '/ai-practice/reading', icon: '🤖', label: 'הבנת הנקרא (AI)' },
  { href: '/ai-practice/sentence', icon: '🤖', label: 'בניית משפט (AI)' },
]

interface StudentSidebarProps {
  difficultyFilter: number | null
  onDifficultyFilterChange: (level: number | null) => void
  availableDifficulties: number[]
}

/**
 * Wraps /menu only (an explicit component the page imports, not a new
 * route-group layout) — keeps this pass's blast radius small, no files
 * moved. Horizontal scroll strip on mobile, a real fixed sidebar from `md:`
 * up (matches the "sidebar for easy navigation and filtering" request).
 */
export function StudentSidebar({ difficultyFilter, onDifficultyFilterChange, availableDifficulties }: StudentSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-full md:w-60 shrink-0 md:h-screen md:sticky md:top-0 bg-surface border-b md:border-b-0 md:border-l border-card-border p-4 flex flex-row md:flex-col gap-4 overflow-x-auto md:overflow-visible">
      <div className="flex items-center justify-between shrink-0">
        <span className="font-bold text-fg whitespace-nowrap">תרגול ניצנים</span>
        <ThemeToggle />
      </div>

      <nav className="flex flex-row md:flex-col gap-1 shrink-0">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
              pathname === item.href
                ? 'bg-highlight/10 text-highlight'
                : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      {availableDifficulties.length > 1 && (
        <div className="hidden md:block mt-auto pt-4 border-t border-card-border">
          <span className="text-xs text-fg/60 block mb-2">סינון סטי הבנת הנקרא לפי רמה</span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onDifficultyFilterChange(null)}
              className={`text-xs px-2 py-1 rounded-md transition ${
                difficultyFilter === null ? 'bg-highlight text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70'
              }`}
            >
              הכל
            </button>
            {availableDifficulties.map(level => (
              <button
                key={level}
                type="button"
                onClick={() => onDifficultyFilterChange(level)}
                className={`text-xs px-2 py-1 rounded-md transition ${
                  difficultyFilter === level ? 'bg-highlight text-white' : 'bg-black/5 dark:bg-white/5 text-fg/70'
                }`}
              >
                רמה {level}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
