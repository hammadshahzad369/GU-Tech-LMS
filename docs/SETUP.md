# Development and deployment guide

## Setup (9 steps)

1. Install Node.js 22+ (22 or 24 supported), clone this repository, and run `npm ci` in its root.
2. Create a Supabase project. Under **Authentication → Sign In / Providers**, disable **Allow new users to sign up**. Keep email/password login enabled.
3. For a **new empty public schema only**, run the entire `supabase/SETUP.sql` once in Supabase SQL Editor. It combines the five ordered migrations. Do not rerun it over a partially applied database: inspect which migrations succeeded first. Do not drop an existing schema to fix setup.
4. Copy `.env.example` to `.env` in the repository root. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` (publishable key accepted), and `SUPABASE_SERVICE_ROLE_KEY` (server-only secret/service-role key). Set the matching `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never put the admin key in a `VITE_` variable. Vite reads root `.env` through its configured env directory.
5. Run `npm run seed`. This creates 1 admin, 2 teachers, 5 students and 3 courses with assignments, practice quizzes, sample graded submissions and a welcome announcement. Newly created accounts' generated password is saved in the Git-ignored `.demo-credentials.local.txt`. Existing passwords are preserved. `DEMO_PASSWORD` can optionally supply your own strong demo password through the environment.
6. In Supabase **Authentication → URL Configuration**, set the Site URL to your frontend origin and add `http://localhost:5173/reset-password` to allowed redirect URLs. For production add `https://YOUR-HOST/reset-password`. Configure custom SMTP for reliable emails to arbitrary recipients; Supabase's default email service has recipient/rate restrictions.
7. Run `npm run dev`. The web server runs on port 5173 and proxies `/api` to Express on port 4000. Sign in using a seeded account. Admin-created accounts must change their temporary password.
8. Validate with `npm run typecheck`, `npm run test`, `npm run test:db`, `npm run build`, and `npm run test:e2e`. Browser tests use installed Chromium (`CHROMIUM_PATH` can override the executable). They exercise fixture-backed UI flows, not hosted integrations.
9. Deploy as described below, set the production origin and recovery URL, then validate login, one write/read/update/delete cycle, private file download, chat between two real sessions and recovery email delivery against your hosted instance.

`npm run db:reset` applies the ordered SQL files using `psql` and `DATABASE_URL`; despite its required spec name, it deliberately **does not drop hosted data**. Use it only on an empty schema. For an existing database, apply only the missing migration manually. `npm run seed` is safe to repeat for the demo dataset; it preserves existing auth passwords.

## Deployment: Render (recommended for the full upload limits)

Deploy the repository as a **Web Service** on Render using `render.yaml`, or use build command `npm ci --include=dev && npm run build` and start command `npm start`. This runs React and Express on one origin and supports the 25 MB resource upload requirement without a serverless request-size cap. Render free instances may sleep when idle.

Set the variables declared in `render.yaml`. Use your exact production origin (no trailing slash) for `CLIENT_ORIGIN`; set `PASSWORD_RESET_REDIRECT` to that origin plus `/reset-password`. Set `NODE_ENV=production`, `SERVE_WEB=true`, and `VITE_API_URL=/api`. The four Supabase URL/public-key settings are needed at build and runtime. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Build and deploy again after changing any `VITE_` variable.

## Alternative: Vercel

Import the repository with **Other** framework preset, root at repository root, build `npm run build`, output `apps/web/dist`. `vercel.json` routes API requests to the Express function and SPA paths to React. Set the same Supabase variables, `CLIENT_ORIGIN`, `PASSWORD_RESET_REDIRECT` and `NODE_ENV=production`; omit `SERVE_WEB`. Vercel's function request-body limit is approximately 4.5 MB, so this option cannot meet the spec's full 25 MB upload requirement. Use Render for the complete file-upload workflow, or deploy Express separately and configure a same-origin `/api` reverse proxy.
