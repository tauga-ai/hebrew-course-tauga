import { Cairo } from 'next/font/google'
import 'katex/dist/katex.min.css'
import { LanguageProvider } from '@/components/tzav-rishon/LanguageContext'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  preload: true,
  display: 'swap',
})

/**
 * Scoped to this section only (not the root layout), so the Arabic font and
 * KaTeX's CSS never load for students who don't open it. Loading Cairo here
 * — rather than only once the language toggle switches to Arabic — means it
 * starts downloading the moment a student enters any /tzav-rishon page,
 * well before they'd reach the toggle; combined with next/font's automatic
 * preload + fallback-metric matching (both on by default for Google fonts),
 * this avoids a layout shift when actually switching to Arabic mid-session.
 */
export default function TzavRishonLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={cairo.variable}>
      <LanguageProvider>{children}</LanguageProvider>
    </div>
  )
}
