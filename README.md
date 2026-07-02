# Hebrew Course — Tauga

A Next.js (App Router) web app for Hebrew-language practice, aimed at Druze students preparing for military service. Covers reading comprehension, sentence building, a DAPAR-style quantitative/verbal simulation, psychotechnic practice, an AI-driven personal-interview simulator, and a teacher analytics dashboard.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4
- **Auth & DB:** Supabase (`@supabase/ssr` for cookie-based sessions, `@supabase/supabase-js` service-role client for server-side data access)
- **AI:** Google Gemini (`gemini-2.5-flash`) for sentence/interview feedback and generated practice content; Google Cloud Text-to-Speech for Hebrew audio playback
- **Tests:** Node's built-in test runner (`node:test`), executed through `tsx` so `@/...` path aliases resolve

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env.local` and fill in real values (Supabase project keys, Gemini API key — see the comments in `.env.example` for where to get each one).
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Run the test suite (`tests/*.test.ts`) |

## Project Structure

- `src/app/` — routes (App Router). Student-facing pages at the top level (`menu`, `dapar`, `sentence`, `interview`, `psychotechnic`, `simulation`, `ai-practice`), teacher pages under `teacher/`, API routes under `api/`.
- `src/lib/` — shared logic: Supabase clients (`supabase.ts`, `supabase/client.ts`, `supabase/server.ts`), auth helpers (`auth.ts`), grading/content modules (`dapar.ts`, `psychotechnic.ts`, `sentence-exercises.ts`, `interview-questions.ts`), and shared hooks under `lib/hooks/`.
- `src/proxy.ts` — session-refresh middleware; a UX-only redirect for unauthenticated users. Actual authorization is enforced per-route via the helpers in `lib/auth.ts`, not here.
- `supabase/` — SQL schema and seed data.
- `tests/` — unit tests for pure functions in `lib/`, plus a static guard test that every service-role API route uses an auth helper.

## Authentication

Students and teachers both authenticate through Supabase Auth (email/password or Google OAuth for students; email/password for teachers). Every API route that touches the database via the service-role client derives the caller's identity from the Supabase session server-side (`getStudentFromSession()` / `requireTeacher()` in `src/lib/auth.ts`) — client-supplied IDs are never trusted. `tests/auth-guard.test.mjs` enforces this pattern statically.
