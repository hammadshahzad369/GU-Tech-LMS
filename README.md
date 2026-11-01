# GUTECH Student & Faculty Portal

A responsive university LMS built with React 18, Vite, TypeScript, Node.js/Express and Supabase Postgres, Auth, private Storage and Realtime. The interface uses GUTECH-inspired maroon and white branding.

## What is implemented

- Admin, teacher and student dashboards; no public signup.
- Admin-created users, deactivation, forced temporary-password changes and email password recovery.
- Course management, teacher assignment, student enrollment and archival.
- Private resources with file-signature validation and short-lived download links.
- Assignment submissions, deadlines, grading, feedback and resubmission.
- Timed single/multiple-choice and true/false quizzes; server scoring; private answer keys.
- Course/global announcements, pinned posts, read tracking and live badges.
- Marks, gradebook records and CSV export.
- Course-member Realtime text chat, deletion and send retries.
- Private complaints, attachments and admin response workflow.

## Architecture

`apps/web` is the React SPA. Its HTTP requests go to `apps/api`, which verifies Supabase JWTs and the active profile before database access. Requests use the user's JWT so database RLS still applies. The browser connects directly to Supabase only for Realtime subscriptions. The server-only admin key is used for account provisioning and clearing the temporary-password flag; it is never sent to the browser. Sensitive state transitions and quiz scoring are atomic Postgres functions with explicit role checks. SQL migrations live in `supabase/migrations`.

## Technology

React 18 · TypeScript · Vite · Node.js · Express · Supabase · Tailwind CSS

## Project status

The prototype has passed local build, API, database-policy and browser checks. Hosted authentication, storage, Realtime and deployment validation are in progress.
