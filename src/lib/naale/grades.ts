/** Naale grade levels, stored as Hebrew letters: ז=7 … ט=9, י=10, יא=11, יב=12.
 *  Keep in sync with the CHECK constraints in supabase/migrations/*_naale_grades_10_12.sql. */
export const GRADES = ['ז', 'ח', 'ט', 'י', 'יא', 'יב'] as const
export type NaaleGrade = (typeof GRADES)[number]

/** Maps the sheet's class label to a grade: `י׳ נעלה` → `י`, `י״א צברים` → `יא`
 *  (drops the group word and geresh/gershayim). Unknown input is returned as-is
 *  so the validator reports the original text. */
export function normalizeGrade(raw: string): string {
  const token = raw.trim().split(/\s+/)[0].replace(/[׳״'"]/g, '')
  return (GRADES as readonly string[]).includes(token) ? token : raw
}

/** Group buttons/options for 10th-11th grade, labels as Yonatan wrote them.
 *  `value` is `<grade>|<cohort>`. */
export const GROUP_FILTERS = [
  { value: 'י|naale', label: "י' נעלה" },
  { value: 'י|tzabarim', label: "י' צברים" },
  { value: 'יא|naale', label: 'י"א נעלה' },
  { value: 'יא|tzabarim', label: 'י"א צברים' },
]

/** Group within a grade (10th-11th only): נעלה = naale, צברים = tzabarim. */
export const COHORTS = ['naale', 'tzabarim'] as const
export type NaaleCohort = (typeof COHORTS)[number]

/** Reads the group word off a class label: `י׳ נעלה` → `naale`. Null when absent. */
export function parseCohort(raw: string): NaaleCohort | null {
  const word = raw.trim().split(/\s+/)[1]
  return word === 'נעלה' ? 'naale' : word === 'צברים' ? 'tzabarim' : null
}
