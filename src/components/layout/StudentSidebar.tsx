'use client'

import { useState } from 'react'
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
  // Lazy-initialized from a cookie (this project's convention for
  // non-critical UI prefs — see ThemeProvider/active_class_id), read once
  // at mount rather than synced via an effect. `document` is unavailable
  // during the server render pass, so that pass always starts expanded;
  // deliberately simpler than theme's useSyncExternalStore dance, which
  // exists to prevent a much more jarring global color flash — not needed
  // for a local layout preference.
  const [collapsed, setCollapsed] = useState(
    () => typeof document !== 'undefined' && document.cookie.includes('sidebar_collapsed=1')
  )

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    document.cookie = next
      ? 'sidebar_collapsed=1; path=/; max-age=31536000'
      : 'sidebar_collapsed=; path=/; max-age=0'
  }

  // Desktop-only concern — collapsed never affects the mobile horizontal
  // scroll strip, so every conditional class below only ever adds an
  // `md:` prefixed class, never a bare one that would also hide on mobile.
  const hideOnCollapse = collapsed ? 'md:hidden' : ''

  return (
    <aside className={`w-full ${collapsed ? 'md:w-14' : 'md:w-60'} shrink-0 md:h-screen md:sticky md:top-0 bg-surface border-b md:border-b-0 md:border-l border-card-border p-4 flex flex-row md:flex-col gap-4 overflow-x-auto md:overflow-visible transition-all`}>
      <div className="flex items-center justify-between shrink-0">
        <span className={`font-bold text-fg whitespace-nowrap ${hideOnCollapse}`}>תרגול ניצנים</span>
        <span className={hideOnCollapse}><ThemeToggle /></span>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'הרחב סרגל' : 'כווץ סרגל'}
          className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-fg/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-fg/80 transition shrink-0"
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      <nav className="flex flex-row md:flex-col gap-1 shrink-0">
        {/* Group headers are desktop-only — the flat scroll strip on mobile
            has no room for them, so items there just run classroom-then-home
            in sequence with no visual split (hidden removes them from the
            flex-row flow entirely, so the mobile gap is unaffected). Also
            hidden when collapsed, alongside the nav item labels below. */}
        <span className={`hidden ${collapsed ? '' : 'md:block'} text-xs font-semibold text-fg/40 px-3 pt-1 pb-1`}>תרגול בכיתה</span>
        {CLASSROOM_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap md:whitespace-normal transition ${
              isActive(item, pathname)
                ? 'bg-highlight/10 text-highlight'
                : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span>{item.icon}</span>
            <span className={hideOnCollapse}>{item.label}</span>
          </Link>
        ))}
        <span className={`hidden ${collapsed ? '' : 'md:block'} text-xs font-semibold text-fg/40 px-3 pt-3 pb-1 md:border-t md:border-card-border md:mt-2`}>תרגול בבית</span>
        {HOME_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap md:whitespace-normal transition ${
              isActive(item, pathname)
                ? 'bg-highlight/10 text-highlight'
                : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
            }`}
          >
            <span>{item.icon}</span>
            <span className={hideOnCollapse}>{item.label}</span>
          </Link>
        ))}
        <span className={`hidden ${collapsed ? '' : 'md:block'} md:border-t md:border-card-border md:mt-2 md:pt-2`} />
        <Link
          href={PROGRESS_ITEM.href}
          title={PROGRESS_ITEM.label}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition ${
            isActive(PROGRESS_ITEM, pathname)
              ? 'bg-highlight/10 text-highlight'
              : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
          }`}
        >
          <span>{PROGRESS_ITEM.icon}</span>
          <span className={hideOnCollapse}>{PROGRESS_ITEM.label}</span>
        </Link>
      </nav>
    </aside>
  )
}
