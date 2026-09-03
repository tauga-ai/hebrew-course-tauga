'use client'

import { useState } from 'react'
import { t } from '@/lib/dev-i18n'
import pictureBlurs from '@/data/naale/picture-blurs.json'

type Status = 'loading' | 'loaded' | 'error'

const BLURS: Record<string, string> = pictureBlurs

/**
 * Renders a picture-description question's image with a skeleton placeholder while it loads.
 * State is intentionally local (not lifted to the page) — both session/page.tsx and
 * placement/page.tsx already remount this component's whole ancestor subtree on every question
 * change (`key={q.id}`), so a fresh `loading` state per question comes for free.
 */
export function PictureDescriptionImage({ pictureNumber }: { pictureNumber: string }) {
  const [status, setStatus] = useState<Status>('loading')
  const blur = BLURS[pictureNumber]

  return (
    <div className="relative w-full max-w-sm mx-auto aspect-[4/3] mb-4 rounded-xl border border-card-border bg-black/5 dark:bg-white/5 overflow-hidden">
      {status === 'loading' && (
        blur ? (
          // scale-110 keeps blur-lg's edge falloff hidden past this card's own overflow-hidden
          // border, instead of showing a visibly sharper rim around the blurred preview.
          <div
            aria-hidden
            className="absolute inset-0 scale-110 bg-cover bg-center blur-lg"
            style={{ backgroundImage: `url(${blur})` }}
          />
        ) : (
          <div className="absolute inset-0 animate-pulse bg-black/10 dark:bg-white/10" />
        )
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-fg/50">
          {t('לא ניתן לטעון את התמונה')}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- source image dimensions vary per picture; same rationale as makbatzim's image questions. */}
      <img
        src={`/api/naale/pictures/${pictureNumber}`}
        alt=""
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
        className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-200 ${
          status === 'loaded' ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  )
}
