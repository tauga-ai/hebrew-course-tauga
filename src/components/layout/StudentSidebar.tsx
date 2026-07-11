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
  /** Path prefixes that should NOT count as active for this item even though they're nested under `href` — for a child route that has its own top-level nav entry. */
  excludeUnder?: string[]
}

/** Mirrors the two-section split on the /menu dashboard ("תרגול בכיתה" / "תרגול בבית"). */
const CLASSROOM_ITEMS: NavItem[] = [
  { href: '/simulation', icon: '🏆', label: 'סימולציה עברית' },
  { href: '/makbatzim/dapar-simulation', icon: '🧮', label: 'סימולציה דפ"ר' },
  { href: '/sentence', icon: '✍️', label: 'בניית משפטים' },
  { href: '/reading-sets', icon: '📖', label: 'תרגול הבנת הנקרא', alsoActiveUnder: ['/practice'] },
  { href: '/makbatzim', icon: '🧮', label: 'מקבצים פסיכוטכני', excludeUnder: ['/makbatzim/dapar-simulation'] },
]

const HOME_ITEMS: NavItem[] = [
  { href: '/tzav-rishon', icon: '🎯', label: 'תרגול עצמי כמותי - עברית וערבית' },
  { href: '/interview', icon: '🗣️', label: 'ראיון אישי' },
  { href: '/ai-practice/reading', icon: '🤖', label: 'הבנת הנקרא (AI)' },
  { href: '/ai-practice/sentence', icon: '🤖', label: 'בניית משפט (AI)' },
]

const PROGRESS_ITEM: NavItem = { href: '/student/personal-details', icon: '📊', label: 'ההתקדמות שלי' }

function isActive(item: NavItem, pathname: string): boolean {
  const matches = pathname === item.href
    || pathname.startsWith(`${item.href}/`)
    || (item.alsoActiveUnder ?? []).some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
  const excluded = (item.excludeUnder ?? []).some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`))
  return matches && !excluded
}

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
        {/* Group headers are desktop-only — the flat scroll strip on mobile
            has no room for them, so items there just run classroom-then-home
            in sequence with no visual split (hidden removes them from the
            flex-row flow entirely, so the mobile gap is unaffected). */}
        <span className="hidden md:block text-xs font-semibold text-fg/40 px-3 pt-1 pb-1">תרגול בכיתה</span>
        {CLASSROOM_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
              isActive(item, pathname)
                ? 'bg-highlight/10 text-highlight'
                : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
        <span className="hidden md:block text-xs font-semibold text-fg/40 px-3 pt-3 pb-1 md:border-t md:border-card-border md:mt-2">תרגול בבית</span>
        {HOME_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
              isActive(item, pathname)
                ? 'bg-highlight/10 text-highlight'
                : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
        <span className="hidden md:block md:border-t md:border-card-border md:mt-2 md:pt-2" />
        <Link
          href={PROGRESS_ITEM.href}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
            isActive(PROGRESS_ITEM, pathname)
              ? 'bg-highlight/10 text-highlight'
              : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <span>{PROGRESS_ITEM.icon}</span>
          <span>{PROGRESS_ITEM.label}</span>
        </Link>
      </nav>
    </aside>
  )
}
