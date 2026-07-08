import 'katex/dist/katex.min.css'

/** Scoped to this section only (not the root layout), so KaTeX's CSS never loads for students who don't open it. */
export default function MakbatzimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
