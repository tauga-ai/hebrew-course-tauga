/** Naale grade levels, stored as Hebrew letters: ז=7 … ט=9, י=10, יא=11, יב=12.
 *  Keep in sync with the CHECK constraints in supabase/migrations/*_naale_grades_10_12.sql. */
export const GRADES = ['ז', 'ח', 'ט', 'י', 'יא', 'יב'] as const
export type NaaleGrade = (typeof GRADES)[number]
