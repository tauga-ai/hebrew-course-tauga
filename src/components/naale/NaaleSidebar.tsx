'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { LtrIsolate } from '@/components/tzav-rishon/LtrIsolate'
import { t } from '@/lib/dev-i18n'

export interface NaaleSidebarProps {
  role: 'student' | 'staff'
}

interface NavItem {
  href: string
  icon: string
  label: string
}

const STUDENT_ITEMS: NavItem[] = [
  { href: '/naale', icon: '▶️', label: 'תרגול' },
  { href: '/naale/stats', icon: '📊', label: 'ההתקדמות שלי' },
]
const STAFF_ITEMS: NavItem[] = [{ href: '/naale/staff', icon: '👥', label: 'תלמידים' }]

interface MyStatsTotals {
  xp: number
  coins: number
  streak: number
}

/**
 * Naale's own desktop-aware shell — visually cloned from StudentSidebar
 * (same tokens, breakpoints, and collapse pattern), but a genuinely separate
 * component living under components/naale/, not a reuse of StudentSidebar
 * itself: that component's NavItem[] is hardcoded to draft-prep routes, and
 * importing it would break Naale's track isolation (see
 * naale-track-first-build/CONTEXT.md's "traps" list). Keeping it under a
 * Naale-specific path — rather than components/layout/, which reads as "the
 * shared layout, safe to use anywhere" — keeps that isolation boundary
 * visible in the codebase, not just in a comment.
 *
 * A distinct cookie (naale_sidebar_collapsed, not StudentSidebar's
 * sidebar_collapsed) so the two components' collapse preferences don't
 * collide for a hypothetical future account that sees both.
 */
export function NaaleSidebar({ role }: NaaleSidebarProps) {
  const pathname = usePathname()
  const items = role === 'staff' ? STAFF_ITEMS : STUDENT_ITEMS

  const [collapsed, setCollapsed] = useState(
    () => typeof document !== 'undefined' && document.cookie.includes('naale_sidebar_collapsed=1')
  )
  const [stats, setStats] = useState<MyStatsTotals | null>(null)

  useEffect(() => {
    let cancelled = false
    // Best-effort, same pattern as NaaleHome's rewards fetch: a failed fetch
    // just hides this block rather than erroring the whole shell.
    fetch('/api/naale/my-stats')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled && data) setStats(data.totals)
      })
      .catch(() => { })
    return () => {
      cancelled = true
    }
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    document.cookie = next
      ? 'naale_sidebar_collapsed=1; path=/; max-age=31536000'
      : 'naale_sidebar_collapsed=; path=/; max-age=0'
  }

  // Desktop-only concern — collapsed never affects the mobile horizontal
  // scroll strip, so every conditional class below only ever adds an
  // `md:` prefixed class, never a bare one that would also hide on mobile.
  const hideOnCollapse = collapsed ? 'md:hidden' : ''

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <aside
      className={`w-full ${collapsed ? 'md:w-14' : 'md:w-60'} shrink-0 md:h-screen md:sticky md:top-0 bg-surface border-b md:border-b-0 md:border-l border-card-border p-4 flex flex-row md:flex-col gap-4 overflow-x-auto md:overflow-visible transition-all`}
    >
      <div className="flex items-center justify-between shrink-0">
        <span className={`font-bold text-fg whitespace-nowrap ${hideOnCollapse}`}>{t('נעלה')}</span>
        <div className="flex items-center gap-1">
          <span className={hideOnCollapse}>
            <ThemeToggle />
          </span>
          <button
            type="button"
            onClick={toggleCollapsed}
            title={t(collapsed ? 'הרחב סרגל' : 'כווץ סרגל')}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-lg text-fg/50 hover:bg-black/5 dark:hover:bg-white/5 hover:text-fg/80 transition shrink-0"
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>
      </div>

      <nav className="flex flex-row md:flex-col gap-1 shrink-0">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            title={t(item.label)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap md:whitespace-normal transition ${isActive(item.href) ? 'bg-highlight/10 text-highlight' : 'text-fg/70 hover:bg-black/5 dark:hover:bg-white/5'
              }`}
          >
            <span>{item.icon}</span>
            <span className={hideOnCollapse}>{t(item.label)}</span>
          </Link>
        ))}
      </nav>

      {stats && (
        <div
          className={`flex flex-row items-center justify-center gap-3 text-xs text-fg/70 shrink-0 md:mt-auto md:pt-3 md:border-t md:border-card-border ${hideOnCollapse}`}
        >
          <span className="flex items-center gap-1">
            🔥 <LtrIsolate>{stats.streak}</LtrIsolate>
          </span>
          <span className="flex items-center gap-1">
            ⭐ <LtrIsolate>{stats.xp}</LtrIsolate>
          </span>
          <span className="flex items-center gap-1">
            🪙 <LtrIsolate>{stats.coins}</LtrIsolate>
          </span>
        </div>
      )}
    </aside>
  )
}
