import dotenv from 'dotenv';
import { resolve } from 'node:path';
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../../.env') });
export const env = {
  url: process.env.SUPABASE_URL || '',
  key: process.env.SUPABASE_ANON_KEY || '',
  serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  reset: process.env.PASSWORD_RESET_REDIRECT || 'http://localhost:5173/reset-password',
  production: process.env.NODE_ENV === 'production',
};
