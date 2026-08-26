'use client'

import type { ReactNode } from 'react'
import { NaaleSidebar, type NaaleSidebarProps } from '@/components/naale/NaaleSidebar'

interface NaaleShellProps extends NaaleSidebarProps {
  children: ReactNode
  /** The one real difference between pages that used this shell's markup
   *  before it existed — default covers the common case (naale/page.tsx,
   *  stats, staff, admin). */
  contentClassName?: string
}

/**
 * Replaces the `<div className="min-h-screen md:flex"><NaaleSidebar/>...`
 * wrapper that was copy-pasted identically across 7 pages — one place to
 * change instead of seven.
 *
 * Deliberately has no opinion on text direction: the sidebar follows the
 * document's real `dir` like everything else in the app, which in real
 * Hebrew/RTL mode puts it on the right. An earlier version of this
 * component forced `dir="ltr"` here to pin the sidebar to the physical left
 * in every language — reverted once live-testing in real Hebrew clarified
 * that right-in-Hebrew is the wanted behavior, not a bug; the "should be on
 * the left" starting point turned out to describe the dev-only English
 * toggle, not the app's actual Hebrew-reading users.
 */
export function NaaleShell({ children, contentClassName = 'max-w-5xl', ...sidebarProps }: NaaleShellProps) {
  return (
    <div className="min-h-screen md:flex">
      <NaaleSidebar {...sidebarProps} />
      {/* pb-20 clears the mobile bottom tab bar (NaaleSidebar renders it
          fixed) — md:pb-4 drops back to the plain padding once that bar is
          hidden and the desktop rail takes over. min-w-0 overrides a flex
          item's default min-width:auto, which otherwise refuses to shrink
          this pane below its content's intrinsic width (e.g. a table with
          whitespace-nowrap cells) once the sidebar claims its share of a
          narrow viewport — without it, content overflows the page at
          in-between widths like 768px instead of scrolling inside its own
          overflow-x-auto container. */}
      <div className={`flex-1 min-w-0 p-4 pb-20 md:pb-4 ${contentClassName} mx-auto w-full`}>
        {children}
      </div>
    </div>
  )
}
