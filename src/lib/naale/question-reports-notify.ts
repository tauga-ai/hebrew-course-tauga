import 'server-only'
import nodemailer from 'nodemailer'
import { REPORT_NOTIFY_ENV } from './question-reports'

export interface ReportNotification {
  reportId: string
  questionId: string
  topic: string
  note: string
}

/**
 * Gmail SMTP via an App Password, not a dedicated transactional-email service
 * (Resend was the original recommendation) — decided 2026-08-23 as simpler to
 * stand up for a low-volume internal notification. `GMAIL_USER`/
 * `GMAIL_APP_PASSWORD` unset (e.g. in CI, or before the account is
 * configured) is treated the same as "no recipients": log and return, rather
 * than let nodemailer throw a confusing auth error on every report.
 */
const transporter = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    })
  : null

/**
 * Tells whoever is configured that a report came in.
 *
 * The report is already committed to naale_question_reports before this runs,
 * and the staff page reads from that table — so a failed/misconfigured send
 * loses a notification, never a report. That ordering is the whole reason the
 * ticket says "never rely on the notification alone; a lost email is a lost
 * report" — this function must never throw.
 *
 * Called via Next's `after()` from the route handler (fire-and-forget would
 * risk the serverless function freezing before the send completes).
 */
export async function notifyQuestionReport(report: ReportNotification): Promise<void> {
  const recipients = (process.env[REPORT_NOTIFY_ENV] ?? '')
    .split(',')
    .map(address => address.trim())
    .filter(Boolean)

  if (!recipients.length) {
    console.info(`[naale-question-report] no recipients configured — set ${REPORT_NOTIFY_ENV}`)
    return
  }

  if (!transporter) {
    console.info(
      `[naale-question-report] report=${report.reportId} question=${report.questionId} topic=${JSON.stringify(report.topic)} ` +
        `recipients=${recipients.join(';')} note=${JSON.stringify(report.note)} ` +
        `(no email sent — GMAIL_USER/GMAIL_APP_PASSWORD not configured)`
    )
    return
  }

  try {
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recipients,
      subject: `Naale question report — ${report.topic}`,
      text: `Question ${report.questionId}: ${report.note}`,
    })
  } catch (err) {
    // Contract unchanged: a failed send must never fail the student's submission.
    console.error('[naale-question-report] notification send failed:', err)
  }
}
