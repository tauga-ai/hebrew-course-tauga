import 'server-only'
import nodemailer from 'nodemailer'
import { REPORT_NOTIFY_ENV } from './question-reports'

export interface ReportNotification {
  reportId: string
  questionId: string
  topic: string
  difficulty: number | string
  kind: 'mcq' | 'open'
  prompt: string
  note: string
  studentAnswer: string | null
  studentWasCorrect: boolean | null
}

// Where staff can go to see/edit the reported question. No dedicated
// per-report deep link exists yet (naale-report-quick-edit lists all reports
// on one page), so this points at the list rather than a specific row.
const STAFF_REPORTS_URL = 'https://hebrew-course-tauga.vercel.app/naale/staff/reports'

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function answerRowHtml(report: ReportNotification): string {
  if (report.studentAnswer === null && report.studentWasCorrect === null) return ''
  const verdict =
    report.studentWasCorrect === null
      ? ''
      : report.studentWasCorrect
        ? '<span style="color:#15803d;font-weight:600;">correct</span>'
        : '<span style="color:#b91c1c;font-weight:600;">incorrect</span>'
  const answerText = report.studentAnswer
    ? `<div style="margin-top:4px;color:#1f2937;">${escapeHtml(report.studentAnswer)}</div>`
    : ''
  return `
    <tr>
      <td style="padding:10px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;vertical-align:top;">Student's answer</td>
      <td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:14px;">${verdict}${answerText}</td>
    </tr>`
}

function buildHtml(report: ReportNotification): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <tr>
      <td style="background:#111827;padding:20px 24px;">
        <div style="color:#f9fafb;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.7;">Naale · question report</div>
        <div style="color:#ffffff;font-size:18px;font-weight:600;margin-top:4px;">A student flagged question ${escapeHtml(report.questionId)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <table role="presentation" width="100%" style="border-collapse:collapse;">
          <tr>
            <td style="padding:10px 0;color:#6b7280;font-size:13px;vertical-align:top;width:130px;">Topic</td>
            <td style="padding:10px 0;font-size:14px;font-weight:600;color:#111827;">${escapeHtml(report.topic)}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;vertical-align:top;">Kind / difficulty</td>
            <td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:14px;color:#111827;">${escapeHtml(report.kind)} · difficulty ${escapeHtml(String(report.difficulty))}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-top:1px solid #e5e7eb;color:#6b7280;font-size:13px;vertical-align:top;">Question</td>
            <td style="padding:10px 0;border-top:1px solid #e5e7eb;font-size:14px;color:#111827;">${escapeHtml(report.prompt)}</td>
          </tr>
          ${answerRowHtml(report)}
        </table>

        <div style="margin-top:20px;padding:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
          <div style="font-size:12px;font-weight:600;color:#92400e;text-transform:uppercase;letter-spacing:.05em;">What the student said</div>
          <div style="margin-top:6px;font-size:14px;color:#78350f;white-space:pre-wrap;">${escapeHtml(report.note)}</div>
        </div>

        <div style="margin-top:24px;text-align:center;">
          <a href="${STAFF_REPORTS_URL}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px;">Open reports</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
        <div style="font-size:11px;color:#9ca3af;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">Report ${escapeHtml(report.reportId)}</div>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildText(report: ReportNotification): string {
  const lines = [
    `Naale question report`,
    `Question: ${report.questionId} (${report.kind}, difficulty ${report.difficulty})`,
    `Topic: ${report.topic}`,
    `Prompt: ${report.prompt}`,
  ]
  if (report.studentAnswer !== null || report.studentWasCorrect !== null) {
    const verdict =
      report.studentWasCorrect === null ? '' : report.studentWasCorrect ? ' (correct)' : ' (incorrect)'
    lines.push(`Student's answer: ${report.studentAnswer ?? '—'}${verdict}`)
  }
  lines.push('', `Note: ${report.note}`, '', `Open reports: ${STAFF_REPORTS_URL}`, '', `Report ${report.reportId}`)
  return lines.join('\n')
}

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
      text: buildText(report),
      html: buildHtml(report),
    })
  } catch (err) {
    // Contract unchanged: a failed send must never fail the student's submission.
    console.error('[naale-question-report] notification send failed:', err)
  }
}
