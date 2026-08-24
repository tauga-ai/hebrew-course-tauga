/**
 * Issues a Naale sign-in password to a roster member, so they can use the
 * email+password option on /naale/login instead of Google.
 *
 * Being on naale_roster grants access but does not create an account. That
 * normally happens on first Google sign-in — and an account created that way
 * has NO password at all. This script is what gives a roster member
 * credentials they can actually type.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/set-naale-password.ts <email> [--password <pw>] [--dry-run]
 *   npx tsx --env-file=.env.local scripts/set-naale-password.ts --all [--reset] [--out creds.csv] [--dry-run]
 *
 * Single-email mode creates the account, or resets its password if it exists.
 *
 * --all covers every roster row but SKIPS addresses that already have a
 * PASSWORD unless --reset is passed — so re-running it to onboard new roster
 * rows can't silently reset the whole school's passwords. Note "has a
 * password", not "has an account": a Google user has an account with no
 * password, and --all deliberately DOES give them one, so both sign-in
 * options work for them.
 *
 * See .claude/ai-docs/docs/naale-password-login/issuing-credentials.md for the
 * counselor-facing version of all this.
 */
import { writeFileSync } from 'fs'
import { createServiceClient } from '../src/lib/supabase/service'
import { findAuthUserByEmail, hasPasswordIdentity } from '../src/lib/naale/auth-admin'

type Db = ReturnType<typeof createServiceClient>
type RosterRow = { email: string; role: 'student' | 'staff' }
type Action = 'created' | 'reset' | 'would-create' | 'would-reset'

/** The shared launch-window password (user's call, 2026-08-24). It is KNOWN —
 *  documented in CLAUDE.md, which is checked in — so anyone with a rostered
 *  student's address can sign in as them. Accepted for launch because there is
 *  no SMTP and therefore no self-serve reset. A staff row won't take it
 *  without --force-default; see resolvePassword(). */
const DEFAULT_PASSWORD = 'Password123!'

const VALUED_FLAGS = new Set(['--password', '--out'])

function parseArgs(argv: string[]) {
  const flags = new Set<string>()
  const opts: Record<string, string> = {}
  const positional: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (VALUED_FLAGS.has(arg)) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} needs a value`)
      opts[arg] = value
      i++
    } else if (arg.startsWith('--')) {
      flags.add(arg)
    } else {
      positional.push(arg)
    }
  }
  return { flags, opts, positional }
}

async function rosterEntry(db: Db, email: string): Promise<RosterRow | null> {
  // ilike, not eq: naale_roster.email is a case-sensitive primary key while
  // Supabase Auth lowercases everything, so a school CSV written with capitals
  // would otherwise look absent. Same rule as getNaaleSession().
  const { data, error } = await db.from('naale_roster').select('email, role').ilike('email', email)
  if (error) throw error
  if (!data?.length) return null

  // Two rows differing only by case is aug-24 Finding B. Sign-in resolves the
  // roster with .maybeSingle(), which errors on two rows — so an account
  // issued here could never actually sign in. Refuse loudly rather than
  // picking one and handing out credentials that don't work.
  if (data.length > 1) {
    throw new Error(
      `${email}: ${data.length} roster rows differ only by case ` +
        `(${data.map(r => r.email).join(', ')}). Fix the roster first — sign-in cannot resolve ` +
        'this address whatever password it has.'
    )
  }
  return data[0] as RosterRow
}

async function issue(db: Db, email: string, password: string, dryRun: boolean): Promise<Action> {
  const existing = await findAuthUserByEmail(db, email)
  if (dryRun) return existing ? 'would-reset' : 'would-create'

  if (existing) {
    // Setting a password on an existing user keeps any Google identity already
    // on it, so the student reaches the same students row — and therefore the
    // same level, XP and history — whichever way they sign in.
    const { error } = await db.auth.admin.updateUserById(existing.id, { password })
    if (error) throw error
    return 'reset'
  }

  // email_confirm: true is required, not cosmetic. Without it Supabase tries to
  // send a confirmation email, and this project has no production SMTP — the
  // account would be created and unusable, with nothing surfaced to whoever ran
  // this. It also marks the address verified.
  const { error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return 'created'
}

function resolvePassword(row: RosterRow, explicit: string | undefined, forceDefault: boolean): string {
  if (explicit) return explicit

  // A staff sign-in can read EVERY student's data through the staff dashboard.
  // The shared default on a staff account exposes the whole cohort rather than
  // one student, so it has to be asked for by name.
  if (row.role === 'staff' && !forceDefault) {
    throw new Error(
      `${row.email} is a staff row. The shared default password would expose every student's ` +
        'data through the staff dashboard. Pass --password <pw>, or --force-default to use it anyway.'
    )
  }
  return DEFAULT_PASSWORD
}

async function main() {
  const { flags, opts, positional } = parseArgs(process.argv.slice(2))
  const all = flags.has('--all')
  const dryRun = flags.has('--dry-run')
  const reset = flags.has('--reset')
  const forceDefault = flags.has('--force-default')
  const explicit = opts['--password']
  const outPath = opts['--out']
  const single = positional[0]

  if ((!all && !single) || (all && single)) {
    console.error('Usage: set-naale-password.ts <email> [--password <pw>] [--dry-run]')
    console.error('       set-naale-password.ts --all [--reset] [--out creds.csv] [--dry-run]')
    process.exit(1)
  }

  const db = createServiceClient()
  const rows: RosterRow[] = []

  if (all) {
    // naale_roster is a provisioned list capped by the size of the cohort, not
    // by usage — deliberately outside the growth-table pagination guard.
    const { data, error } = await db.from('naale_roster').select('email, role').order('email')
    if (error) throw error
    const found = (data ?? []) as RosterRow[]

    // The single-email path gets this check from rosterEntry(); --all reads the
    // table directly, so it needs its own. Without it a case-duplicated address
    // is quietly processed twice and reported as fine, when in fact nobody can
    // sign in as it at all — getNaaleSession() resolves the roster with
    // .maybeSingle(), which errors on two rows. (aug-24 Finding B.)
    const byLower = new Map<string, RosterRow[]>()
    for (const row of found) {
      const key = row.email.toLowerCase()
      byLower.set(key, [...(byLower.get(key) ?? []), row])
    }
    const collisions = [...byLower.values()].filter(group => group.length > 1)
    if (collisions.length > 0) {
      console.error(`${collisions.length} address(es) appear on the roster more than once, ` +
        'differing only by case. Nobody can sign in as these, whatever password they are given:')
      for (const group of collisions) console.error(`  - ${group.map(r => r.email).join(' / ')}`)
      console.error('\nFix the roster first, then re-run. Nothing was written.')
      process.exit(1)
    }
    rows.push(...found)
  } else {
    const row = await rosterEntry(db, single)
    if (!row) {
      console.error(
        `${single} is not on naale_roster. Add them there first — an account for an off-roster ` +
          'address can only ever reach the "contact your counselor" page.'
      )
      process.exit(1)
    }
    rows.push(row)
  }

  const issued: { email: string; role: string; password: string; action: Action }[] = []
  let skipped = 0
  let refused = 0

  for (const row of rows) {
    const email = row.email.toLowerCase()

    // Skip on "already has a PASSWORD", not "already has an account". A
    // Google account exists but has no password, so treating it as already
    // provisioned would leave that person unable to use the email option at
    // all — which is the thing this ticket exists to give them.
    if (all && !reset) {
      const existing = await findAuthUserByEmail(db, email)
      if (existing && hasPasswordIdentity(existing)) {
        console.log(`${email} (${row.role}) — already has a password, skipped. Pass --reset to overwrite.`)
        skipped++
        continue
      }
    }

    let password: string
    try {
      password = resolvePassword(row, explicit, forceDefault)
    } catch (e) {
      // One refused staff row must not abort the rest of a --all run.
      console.error(`  ! ${(e as Error).message}`)
      refused++
      continue
    }

    const action = await issue(db, email, password, dryRun)
    console.log(`${email} (${row.role}) — ${action}.`)
    issued.push({ email, role: row.role, password, action })
  }

  if (outPath && issued.length > 0) {
    const csv = [
      'email,role,password,action',
      ...issued.map(r => `${r.email},${r.role},${r.password},${r.action}`),
    ].join('\n')
    writeFileSync(outPath, csv + '\n')
    console.log(`\nCredentials written to ${outPath} — hand it to the counselor, then delete it.`)
  }

  const tally = [`${issued.length} issued`]
  if (skipped) tally.push(`${skipped} skipped`)
  if (refused) tally.push(`${refused} refused`)
  console.log(dryRun ? `\n--dry-run: nothing written (${tally.join(', ')}).` : `\nDone: ${tally.join(', ')}.`)

  if (issued.length > 0 && !dryRun) {
    console.log(
      'Tell these users to sign in with their PASSWORD, not Google, until identity linking is ' +
        'verified — see the naale-password-login ticket, Phase 5.'
    )
  }
}

main()
