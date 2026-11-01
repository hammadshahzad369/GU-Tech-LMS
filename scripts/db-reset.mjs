import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import 'dotenv/config';
// Apply missing migrations only. Never silently destroy a hosted database.
if (!process.env.DATABASE_URL)
  throw new Error(
    'DATABASE_URL is required for migration application. Alternatively paste supabase/SETUP.sql into Supabase SQL Editor once.',
  );
const files = readdirSync('supabase/migrations')
  .filter((x) => x.endsWith('.sql'))
  .sort();
for (const f of files) {
  const r = spawnSync('psql', ['--set', 'ON_ERROR_STOP=1', '--file', `supabase/migrations/${f}`], {
    env: { ...process.env, PGDATABASE: process.env.DATABASE_URL },
    stdio: 'inherit',
  });
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log('Migrations applied. Run npm run seed next. This command does not drop existing data.');
