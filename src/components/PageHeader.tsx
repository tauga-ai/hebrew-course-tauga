import Link from 'next/link'
import { t } from '@/lib/dev-i18n'

interface PageHeaderProps {
  /** Static destination — rendered as a Link. Ignored if onBack is given. */
  backHref?: string
  /** Use instead of backHref when the back destination depends on component state. */
  onBack?: () => void
  backLabel?: string
  title?: string
  /** Text color class for the title — lets module-specific pages (e.g. purple AI pages) keep their accent. */
  titleColorClass?: string
  subtitle?: string
  right?: React.ReactNode
}

/** Shared back/title/subtitle header strip used across student-facing pages. */
export function PageHeader({ backHref, onBack, backLabel = '← חזרה', title, titleColorClass = 'text-primary-700', subtitle, right }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center mt-4 mb-6">
      {/* min-h + inline-flex, and a negative inline-start margin so the added
          padding doesn't shift the label away from the page edge. Measured at
          ~46x20 in the Naale mobile QA pass; shared by every student page that
          uses this header, so one change covers stats, session and placement. */}
      {onBack ? (
        <button onClick={onBack} className="inline-flex items-center min-h-[44px] px-3 -ms-3 text-sm text-fg/40 hover:text-fg/70">
          {t(backLabel)}
        </button>
      ) : (
        <Link href={backHref!} className="inline-flex items-center min-h-[44px] px-3 -ms-3 text-sm text-fg/40 hover:text-fg/70">
          {t(backLabel)}
        </Link>
      )}
      <div className="text-center">
        {title && <h1 className={`font-bold ${titleColorClass}`}>{title}</h1>}
        {subtitle && <p className="text-xs text-fg/60">{subtitle}</p>}
      </div>
      <div className="text-sm text-fg/60">{right}</div>
    </div>
  )
}
