import type { TzavRishonQuestion } from '@/data/tzav-rishon/types'
import { splitSegments } from './tzav-rishon-segments'

/**
 * TODO(source data): the source spreadsheet's Hebrew explanation was cut off
 * mid-sentence for these 3 questions (content-QA finding from converting the
 * xlsx). Reported to Adi (content owner); she replied 2026-07-xx with the
 * fixes below (Arabic explanation was already complete in all 3 and was used
 * as the reference for what the ending should say). These are applied here
 * as a patch, NOT baked into src/data/tzav-rishon/percentages/data.json, so
 * they survive a re-run of scripts/convert-tzav-rishon.ts against the
 * (still-unfixed) source xlsx.
 *
 * TODO: once the source xlsx itself is corrected, remove the corresponding
 * entry below and re-run the conversion script — otherwise this patch will
 * keep silently overriding the now-correct source data forever.
 */
const HEBREW_EXPLANATION_CORRECTIONS: Record<string, string> = {
  // q5: explanation was truncated mid-calculation ("...=\frac{7\times …").
  // Completed to match the (already-complete) Arabic explanation's ending.
  'percentages:5':
    'דרך ראשונה- שיטת \\displaystyle 10\\% : נמצא כמה הם \\displaystyle 10\\% מתוך \\displaystyle 20 , ע"י חלוקת ה- \\displaystyle 20 ב- \\displaystyle 10 : \\displaystyle \\frac{20}{10}=2 כלומר, \\displaystyle 10\\% מ- \\displaystyle 20 שווים \\displaystyle 2 . כעת, כל שנותר הוא לכפול את ששרת האחוזים שמצאנו ב- \\displaystyle 7 , כדי להגיע ל- \\displaystyle 70\\% : \\displaystyle 2\\times 7=14 דרך שנייה- חישוב מלא: נזכור כי "אחוז" הוא דרך אחרת לומר: חלק מתוך \\displaystyle 100 , לכן \\displaystyle 70\\%=\\frac{70}{100} . נכפול את השבר שמצאנו בשלם שבשאלה ( \\displaystyle 20 שאלות), כדי לדעת כמה תשובות נכונות ענה התלמיד: \\displaystyle \\frac{70}{100}\\times 20=\\frac{7\\times 10\\times 20}{100}=14 .',

  // q9: per Adi's explicit instruction, the incomplete "second method" is
  // removed entirely (she may add a corrected second method later — if so,
  // update this string and the TODO above no longer applies). Conclusion
  // added to match the (already-complete) Arabic explanation, which never
  // had a second method to begin with.
  'percentages:9':
    'תחילה נחשב כמה גרמים נוספו לחטיף, ולאחר מכן נחשב את משקלו החדש של החטיף. נתון לנו שהתוסיפו \\displaystyle 20\\% מהמשקל המקורי. נמצא זאת באמצעות שיטת \\displaystyle 10\\% : נמצא כמה הם \\displaystyle 10\\% מתוך \\displaystyle 70 , ע"י חלוקת ה- \\displaystyle 70 ב- \\displaystyle 10 : \\displaystyle \\frac{70}{10}=7 כלומר, \\displaystyle 10\\% מ- \\displaystyle 70 שווים \\displaystyle 7 . כעת, כל שנותר הוא לכפול את ששרת האחוזים שמצאנו ב- \\displaystyle 2 , כדי להגיע ל- \\displaystyle 20\\% : \\displaystyle 7\\times 2=14 . נוסיף את הכמות שמצאנו למשקל המקורי: \\displaystyle 70+14=84 . לכן, משקל החטיף החדש הוא \\displaystyle 84 גרם.',

  // q12: explanation was truncated right before the final answer
  // ("...כלומר, יש בחווה …"). Completed to match the Arabic explanation.
  'percentages:12':
    'שאלה זו עוסקת באחוזים. עלינו למצוא כמה כבשים שחורות חולות יש בחווה. נפתור את השאלה בשני שלבים: שלב 1 – מציאת כמות הכבשים השחורות: אנו יודעים כי בחווה יש 240 כבשים, ו־40% מהן לבנות. לכן, 60% מהכבשים הן שחורות. 10% מ 240 הם 24 כבשים (חילקנו את 240 ב 10). כדי להגיע ל־60%, נכפיל ב־6 ונקבל: 24 \\times 6 = 144 כלומר, יש 144 כבשים שחורות. שלב 2 – מציאת כמות הכבשים השחורות החולות: נאמר לנו ש־25% מהכבשים השחורות חלו במחלה. 25% הם בדיוק רבע, ולכן נחלק את מספר הכבשים השחורות ב־4: 144 \\div 4 = 36 כלומר, יש בחווה 36 כבשים שחורות חולות.',
}

/** Pure — takes the question as a parameter, no dependency on the data module, so it's unit-testable without the server-only-guarded import chain. */
export function withContentPatch(topic: string, q: TzavRishonQuestion): TzavRishonQuestion {
  const key = `${topic}:${q.id}`
  const correctedHe = HEBREW_EXPLANATION_CORRECTIONS[key]
  if (!correctedHe) return q
  return { ...q, explanation: { ...q.explanation, he: splitSegments(correctedHe) } }
}
