'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

interface NavItem {
  href: string
  icon: string
  label: string
  /** Extra path prefixes that should also count as "active" for this item, for routes that don't live under `href` itself (e.g. a set's actual exercise page). */
  alsoActiveUnder?: string[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/simulation', icon: '🏆', label: 'סימולציה עברית' },
  { href: '/interview', icon: '🗣️', label: 'ראיון אישי' },
  { href: '/sentence', icon: '✍️', label: 'בניית משפטים' },
  { href: '/tzav-rishon', icon: '🎯', label: 'דפ"ר לצו ראשון' },
  { href: '/reading-sets', icon: '📖', label: 'סטי הבנת הנקרא', alsoActiveUnder: ['/practice'] },
  { href: '/ai-practice/reading', icon: '🤖', label: 'הבנת הנקרא (AI)' },
  { href: '/ai-practice/sentence', icon: '🤖', label: 'בניית משפט (AI)' },
  { href: '/makbatzim', icon: '🧮', label: 'שאלות שעדי שלחה' },
]

/**
 * A component each page imports directly (not a route-group layout) —
 * keeps every page's blast radius small, no files moved. Rendered by every
 * student section except the full-screen exam/recording flows
 * (/simulation, /interview/simulate) and /student/personal-details.
 * Horizontal scroll strip on mobile, a real fixed sidebar from `md:` up.
 */
export function StudentSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-full md:w-60 shrink-0 md:h-screen md:sticky md:top-0 bg-surface border-b md:border-b-0 md:border-l border-card-border p-4 flex flex-row md:flex-col gap-4 overflow-x-auto md:overflow-visible">
      <div className="flex items-center justify-between shrink-0">
        <span className="font-bold text-fg whitespace-nowrap">תרגול ניצנים</span>
        <ThemeToggle />
      </div>

      <nav className="flex flex-row md:flex-col gap-1 shrink-0">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
            || pathname.startsWith(`${item.href}/`)
            || (item.alsoActiveUnder ?? []).some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
                active
                  ? 'bg-highlight/10 text-highlight'
                  : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
