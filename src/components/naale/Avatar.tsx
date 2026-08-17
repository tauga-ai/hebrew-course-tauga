'use client'

import { useState } from 'react'

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.trim().slice(0, 2).toUpperCase()
}

/**
 * A Google profile photo when one exists, falling back to an initials badge
 * — on a missing avatar_url, or if the photo URL fails to load (onError).
 * Shared between NaaleSidebar (the caller's own profile) and the staff
 * roster table (each student's row), which is why this outgrew being a
 * locally-declared component in either file.
 */
export function Avatar({ name, avatarUrl, sizeClass = 'w-8 h-8 text-xs' }: { name: string; avatarUrl: string | null; sizeClass?: string }) {
  const [imgFailed, setImgFailed] = useState(false)
  if (avatarUrl && !imgFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external Google photo URL, not a local/optimizable asset
      <img
        src={avatarUrl}
        alt=""
        onError={() => setImgFailed(true)}
        className={`shrink-0 rounded-full object-cover ${sizeClass}`}
      />
    )
  }
  return (
    <span className={`shrink-0 rounded-full bg-accent-naale/15 text-accent-naale font-bold flex items-center justify-center ${sizeClass}`}>
      {initials(name)}
    </span>
  )
}
