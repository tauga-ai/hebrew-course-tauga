import { test } from 'node:test'
import assert from 'node:assert/strict'
import katex from 'katex'
import { withContentPatch } from '../src/lib/tzav-rishon-content-patches'
import type { Segment, TzavRishonQuestion } from '../src/data/tzav-rishon/types'
import percentagesData from '../src/data/tzav-rishon/percentages/data.json'
import averagesData from '../src/data/tzav-rishon/averages/data.json'
import motionData from '../src/data/tzav-rishon/motion/data.json'
import probabilityData from '../src/data/tzav-rishon/probability/data.json'

// Reconstructs exactly what src/data/tzav-rishon/index.ts's getTopicQuestions()
// would return (raw JSON + withContentPatch), without touching the
// server-only-guarded module — so this also exercises the hand-written
// corrected explanations for percentages q5/q9/q12, not just the raw
// converted content.
const TOPICS: Record<string, TzavRishonQuestion[]> = {
  percentages: (percentagesData as TzavRishonQuestion[]).map(q => withContentPatch('percentages', q)),
  averages: (averagesData as TzavRishonQuestion[]).map(q => withContentPatch('averages', q)),
  motion: (motionData as TzavRishonQuestion[]).map(q => withContentPatch('motion', q)),
  probability: (probabilityData as TzavRishonQuestion[]).map(q => withContentPatch('probability', q)),
}

/**
 * The conversion script's brace-balance check is a NECESSARY but not
 * SUFFICIENT condition for valid LaTeX (e.g. `\frac{x}` is balanced but
 * missing \frac's second argument). This test is the real check: every math
 * segment actually shipped to students must be renderable by the exact
 * library the app uses to render it. throwOnError:true here (unlike the
 * app's own throwOnError:false) is deliberate — we want this test to fail
 * loudly on anything KaTeX would otherwise silently show as a red error to
 * a student.
 */
function collectMathSegments(q: TzavRishonQuestion): { field: string; content: string }[] {
  const out: { field: string; content: string }[] = []
  const collect = (field: string, segs: Segment[]) => {
    for (const s of segs) if (s.type === 'math') out.push({ field, content: s.content })
  }
  collect('question.he', q.question.he)
  collect('question.ar', q.question.ar)
  collect('explanation.he', q.explanation.he)
  collect('explanation.ar', q.explanation.ar)
  q.options.forEach((o, i) => {
    collect(`option[${i}].he`, o.he)
    collect(`option[${i}].ar`, o.ar)
  })
  return out
}

for (const [topic, questions] of Object.entries(TOPICS)) {
  test(`${topic}: every math segment renders through KaTeX without a parse error`, () => {
    const failures: string[] = []
    for (const q of questions) {
      for (const { field, content } of collectMathSegments(q)) {
        try {
          katex.renderToString(content, { throwOnError: true })
        } catch (err) {
          failures.push(`q${q.id} ${field}: ${JSON.stringify(content)} -> ${(err as Error).message}`)
        }
      }
    }
    assert.deepEqual(failures, [], `KaTeX rejected ${failures.length} segment(s):\n${failures.join('\n')}`)
  })
}
