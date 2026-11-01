# Validation and remaining integration work

## Verified locally

- React production build and strict TypeScript checks pass.
- API tests exercise routing, authenticated roles, denial paths, body validation, session cookies, upload signatures/size caps and CSV preview.
- Database tests execute all five migration files on a local Postgres engine, including private-bucket policies and Realtime publication DDL against test scaffolding.
- Database behavior checks cover submission isolation, teacher membership, bounded grades, late-submission rejection, resubmission grade reset, private quiz keys, automatic quiz scores, single attempts, complaint transitions, deactivation and RLS on every public table.
- Browser tests cover admin account creation, teacher grading, student submission, login redirects, mobile width and the absence of a signup screen, using explicit API fixtures.

## Required hosted checks — pending

The user has confirmed that the complete Supabase setup SQL now returns “Success, no rows returned.” The earlier missing-table error is resolved by that reported result. Hosted application-level integration checks remain pending.

No server-side Supabase credential has been supplied to the running workspace. Therefore real user creation, demo seeding, password recovery, signed Storage URLs and two-session Realtime delivery have not been tested against the hosted project. No live deployment URL has been issued or verified.

All acceptance criteria requiring hosted Auth, Storage, Realtime or deployment remain **PENDING**, regardless of local test results.

## Prototype limitations

- SMTP and allowed recovery redirects must be configured in Supabase; default email delivery has recipient and rate restrictions.
- Vercel's serverless body-size cap prevents full 25 MB uploads. The Render configuration serves web and API together to support the specified upload sizes.
- Gradebook student rows are paginated; assessment columns are separately paginated (50 assignments and 50 quizzes per column page). CSV exports the selected row/column page with a UTF-8 BOM and formula-injection protection.
- Course/member option pickers show up to 100 options per request. This prototype is intended for the seeded small campus dataset; large directories need additional picker pagination.
- The UI uses a text rendering of the supplied GUTECH wordmark and its maroon palette. An original downloadable logo file can replace it without changing application behavior.
- This is an academic prototype. Performance with 5,000 rows and full WCAG AA auditing have not been verified.
