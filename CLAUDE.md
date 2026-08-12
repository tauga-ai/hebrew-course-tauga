# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

A Next.js (App Router) app for Hebrew-language practice, aimed at Druze students preparing for military service. Covers reading comprehension, sentence building, a DAPAR-style quantitative/verbal simulation, psychotechnic practice, an AI-driven personal-interview simulator, and a teacher analytics dashboard.

## Commands

```bash
npm run dev            # dev server
npm run build           # production build
npm run lint             # ESLint
npm test                     # tsx --test tests/*.ts && node --test tests/*.mjs
```

Run a single test file directly rather than through `npm test`:

```bash
npx tsx --test tests/shuffle.test.ts
node --test tests/auth-guard.test.mjs
```

`.ts` tests are run through `tsx` (so `@/...` path aliases resolve); guard/integration tests that don't need TS live as `.mjs` and run on Node's built-in runner.

## Next.js version note

This repo runs Next.js 16, which renamed `middleware.ts`/`export function middleware` to **`proxy.ts`**/`export function proxy` (see `src/proxy.ts`). If training data or habit points you toward `middleware.ts`, this project uses `proxy.ts` instead. Before relying on other App Router APIs from memory, check `node_modules/next/dist/docs/` — this major version has other breaking changes (e.g. `params`/`searchParams` are asynchronous everywhere, including in `generateImageMetadata`/`Image`).

## Architecture

### Auth boundary: proxy.ts is UX-only, routes are the real gate

`src/proxy.ts` refreshes the Supabase session cookie on every request and redirects unauthenticated users away from pages — but it is explicitly **not** the authorization boundary. Every API route that reads/writes through the service-role client re-derives identity itself:

- `getStudentFromSession()` (`src/lib/auth.ts`) — resolves the Supabase user, then looks up their `students` row by `auth_user_id`. Never trust a client-supplied `student_id`.
- `requireTeacher()` (`src/lib/auth.ts`) — resolves the Supabase user by email, checks `class_teachers` for ownership (a teacher can own multiple classes), then falls back to the `admins` table for super-admins.

`tests/auth-guard.test.mjs` statically enforces this: it scans every `src/app/api/**/route.ts` for `createServiceClient` usage and fails if the file doesn't also reference `getStudentFromSession`/`requireTeacher`, unless the route is explicitly allowlisted as public. When adding a new API route that touches the DB, use one of these helpers or add the route to the allowlist with a reason.

### Server-authoritative DB access

`createServiceClient()` (`src/lib/supabase/service.ts`) uses the Supabase service-role key and bypasses RLS — it's how all API routes talk to the DB. `createClient()` in `src/lib/supabase/server.ts` (cookie-based, RLS-respecting) and `src/lib/supabase/client.ts` (browser) are only used to resolve *who* the caller is via `auth.getUser()`. RLS is enabled on all tables (see `supabase/migration_enable_rls_all_tables.sql` and friends) as defense-in-depth, but the actual access-control logic lives in the auth helpers above, not in RLS policies.

### Teacher/class model

A class (`classes`) can have multiple teachers (`class_teachers`, many-to-many) and can be scoped to a `lesson_group` per teacher-class pairing (null = whole class). `resolveClassAndGroup()` in `src/lib/teacher-data.ts` decides which class+group a given teacher email sees: admins (`admins` table) and teachers who own multiple classes pick via an `active_class_id` cookie (set by a class-selector UI), defaulting to their first owned/lowest-id class; teachers who own exactly one class get it directly with no cookie involved.

### Two content systems

- **Static, bundled content** — `src/data/{makbatzim,tzav-rishon}/*/data.json`, each surfaced through an `index.ts` registry (`getSetQuestions`, `getSetMeta`, etc.). These are compiled into the app; adding a new set means adding a data file and registering it in the corresponding `index.ts`.
- **DB-backed content** — `practice_sets`/`questions` tables, served through `src/app/api/practice-sets/`. This is the one content path where `createServiceClient` is used without an auth helper (allowlisted in `auth-guard.test.mjs` as genuinely public).

Don't assume one content system when working on the other — check which `api/` route or `data/` registry a given page actually reads from.

### AI integration

- Gemini (`gemini-2.5-flash` via `@google/generative-ai`) generates sentence/interview feedback and practice content. `GEMINI_API_KEY` also serves as the Google Cloud TTS key (`src/app/api/tts/route.ts`, `src/lib/tts-client.ts`).
- Feedback routes that have the model grade *and* rewrite a student's answer (e.g. `src/app/api/sentence/feedback/route.ts`) use a second, independent Gemini call as a judge to decide whether the rewrite is actually better — the generating model is biased toward defending its own output, so self-assessment isn't trusted.
- `checkAiRateLimit()` (`src/lib/ai-rate-limit.ts`) enforces one shared limit (15 requests / 3 min) across all AI-backed routes per student, not per-endpoint — check it before calling any AI provider in a new AI route, and make sure the corresponding table has RLS enabled if you add a new one (see the `ai_rate_limits` RLS fix in git history for why this matters).

### Structure

- `src/app/` — routes. Student pages at the top level (`menu`, `dapar`, `sentence`, `interview`, `psychotechnic`, `simulation`, `ai-practice`, `makbatzim`, `tzav-rishon`); teacher pages under `teacher/(protected)/` (gated by `src/app/teacher/(protected)/layout.tsx`); API routes under `api/`.
- `src/lib/` — shared logic: Supabase clients, auth helpers, grading/content modules, hooks under `lib/hooks/`.
- `supabase/` — schema and seed data. Two migration eras exist here, both still real: `supabase/migration_*.sql` are ~20 flat, hand-run files from before the CLI workflow was adopted (2026-08-11) — historical record, applied by hand in the Dashboard, never delete or renumber them. `supabase/migrations/` is the CLI-tracked workflow going forward: `supabase migration new <name>` to scaffold a new dated file, `supabase db push` to apply it (there is no staging environment, so this pushes straight to the one production project — `supabase db push --dry-run` first to preview). The remote's migration history was baselined via `supabase db pull` against the schema the old flat files had already produced, so `db push` only ever needs to carry *new* changes from here on.
- `tests/` — unit tests for pure functions in `lib/`, plus the static auth-guard test described above.

## Temporary dev/test additions — remove before presenting

Running list of things added purely for local QA that must be cleaned up before a demo or production use. Code-side dev-only gates (`isDev`/`NODE_ENV === 'development'`) are safe by construction — Next.js dead-code-eliminates them from production builds, so there's no risk of a stray dev UI shipping live. The risk is DATA: rows created by a script persist in whichever Supabase project `.env.local` points to, regardless of build mode, and won't clean themselves up.

- **Naale dev-only login fallback** (`src/app/naale/login/page.tsx`, the `isDev`-gated email/password form) — code-safe, but remove once Naale no longer needs password-based QA logins.
- **`scripts/create-naale-test-users.ts`** and the 6 accounts it seeds (`naale_student1-3@test.com`, `naale_staff1-3@test.com`, password `Password123!`, documented in the gitignored `test-user.md`) — real rows in `naale_roster` + Supabase Auth. Delete these (roster rows + auth users) before a real demo/production use of that project.
