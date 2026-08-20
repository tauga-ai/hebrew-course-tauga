import 'server-only'
import { REPORT_NOTIFY_ENV } from './question-reports'

export interface ReportNotification {
  reportId: string
  questionId: string
  topic: string
  note: string
}

/**
 * Tells whoever is configured that a report came in.
 *
 * **There is no email or Slack transport in this repo**, and adding one is a
 * new dependency plus new secrets — Noam approved building the storage and the
 * staff page first and leaving delivery configurable until Idan and Yuval
 * settle on addresses. So this deliberately does not attempt to send anything:
 * it emits one structured, greppable line naming the intended recipients.
 *
 * The report is already committed to naale_question_reports before this runs,
 * and the staff page reads from that table — so a missing transport loses a
 * notification, never a report. That ordering is the whole reason the ticket
 * says "never rely on the notification alone; a lost email is a lost report".
 *
 * To finish this: replace the console.info below with a real send, keeping the
 * same "throws nothing" contract — a failed notification must not fail the
 * student's submission.
 */
export function notifyQuestionReport(report: ReportNotification): void {
  const recipients = (process.env[REPORT_NOTIFY_ENV] ?? '')
    .split(',')
    .map(address => address.trim())
    .filter(Boolean)

  console.info(
    `[naale-question-report] report=${report.reportId} question=${report.questionId} topic=${JSON.stringify(report.topic)} ` +
      `recipients=${recipients.length ? recipients.join(';') : `(none configured — set ${REPORT_NOTIFY_ENV})`} ` +
      `note=${JSON.stringify(report.note)}`
  )
}
