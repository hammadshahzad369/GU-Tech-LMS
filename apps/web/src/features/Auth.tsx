import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowUpRight, BookOpen, Eye, EyeOff, GraduationCap, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ErrorBox, Field, Form, value } from '../components/ui';
import { send, setToken } from '../lib/api';
import { useSession } from '../lib/session';
export function AuthPage() {
  const { login, user, refresh } = useSession();
  const nav = useNavigate(),
    location = useLocation();
  const [show, setShow] = useState(false),
    [done, setDone] = useState(false);
  const forgot = location.pathname === '/forgot-password',
    reset = location.pathname === '/reset-password',
    change = location.pathname === '/change-password';
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <div className="wordmark">
          GU<span>TECH</span>
          <small>UNIVERSITY PORTAL</small>
        </div>
        <div className="auth-copy">
          <span className="light-tag">YOUR CAMPUS. CONNECTED.</span>
          <h1>
            Great minds.
            <br />
            One community.
          </h1>
          <p>Your classes, conversations and next big ideas—all in one place.</p>
          <div className="story-features">
            <span>
              <BookOpen />
              Learn without limits
            </span>
            <span>
              <Users />
              Stay connected
            </span>
            <span>
              <GraduationCap />
              Make your mark
            </span>
          </div>
        </div>
        <footer>
          GUTECH Student & Faculty Portal <span>2026</span>
        </footer>
        <div className="orbit one" />
        <div className="orbit two" />
      </aside>
      <main className="auth-main">
        <div className="auth-top">
          GUTECH <span>Academic workspace</span>
        </div>
        <section className="auth-card">
          <div className="eyebrow">
            {change
              ? 'ACCOUNT SECURITY'
              : forgot || reset
                ? 'ACCOUNT RECOVERY'
                : 'WELCOME TO YOUR CAMPUS'}
          </div>
          <h1>
            {change
              ? 'Set your own password'
              : forgot
                ? 'Forgot your password?'
                : reset
                  ? 'A fresh start.'
                  : 'Welcome back.'}
          </h1>
          <p>
            {change
              ? 'Replace your temporary password to access the portal.'
              : forgot
                ? 'Enter your account email. We’ll send you a reset link.'
                : reset
                  ? 'Choose a new password for your account.'
                  : 'Sign in to continue your learning journey.'}
          </p>
          {done ? (
            <div className="success">
              If your account exists, a reset link is on its way. Check your inbox.
            </div>
          ) : !forgot && !reset && !change ? (
            <LoginForm
              onLogin={async (email, password) => {
                await login(email, password);
                nav('/');
              }}
            />
          ) : (
            <Form
              label={
                forgot
                  ? 'Send reset link'
                  : reset || change
                    ? 'Update password'
                    : 'Sign in to portal'
              }
              onSubmit={async (f) => {
                const email = value(f, 'email'),
                  password = value(f, 'password');
                if (forgot) {
                  await send('/auth/forgot-password', 'POST', { email });
                  setDone(true);
                } else if (change) {
                  await send('/auth/change-password', 'POST', {
                    currentPassword: value(f, 'currentPassword'),
                    newPassword: password,
                  });
                  await refresh();
                  nav('/');
                } else if (reset) {
                  if (password !== value(f, 'confirm')) throw new Error('Passwords do not match.');
                  const hash = new URLSearchParams(window.location.hash.slice(1));
                  const access = hash.get('access_token');
                  if (!access)
                    throw new Error(
                      'This recovery link is missing or expired. Request a new link.',
                    );
                  setToken(access);
                  await send('/auth/reset-password', 'POST', { newPassword: password });
                  window.history.replaceState(null, '', '/login');
                  nav('/login');
                } else {
                  await login(email, password);
                  nav('/');
                }
              }}
            >
              {!reset && !change && (
                <Field label="University email">
                  <input
                    name="email"
                    type="email"
                    placeholder="you@gutech.edu.pk"
                    autoComplete="email"
                    required
                  />
                </Field>
              )}
              {change && (
                <Field label="Current password">
                  <input
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </Field>
              )}
              {!forgot && (
                <>
                  <Field label={reset || change ? 'New password' : 'Password'}>
                    <div className="password-input">
                      <input
                        name="password"
                        type={show ? 'text' : 'password'}
                        placeholder={
                          reset || change
                            ? '10+ characters, a letter and a number'
                            : 'Enter your password'
                        }
                        autoComplete={reset || change ? 'new-password' : 'current-password'}
                        minLength={reset || change ? 10 : 1}
                        required
                      />
                      <button
                        type="button"
                        aria-label={show ? 'Hide password' : 'Show password'}
                        onClick={() => setShow(!show)}
                      >
                        {show ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </Field>
                  {reset && (
                    <Field label="Confirm password">
                      <input name="confirm" type="password" required />
                    </Field>
                  )}
                  {!reset && !change && (
                    <div className="form-meta">
                      <span>Secure campus access</span>
                      <Link to="/forgot-password">Forgot password?</Link>
                    </div>
                  )}
                </>
              )}
            </Form>
          )}
          <div className="auth-help">
            {forgot || reset ? (
              <Link to="/login">← Back to sign in</Link>
            ) : change ? (
              <span>At least 10 characters, including a letter and a number.</span>
            ) : (
              <>
                <span>Need an account?</span> Contact your administrator <ArrowUpRight size={14} />
              </>
            )}
          </div>
        </section>
        <footer>
          Powered by GUTECH <span>Learn. Connect. Grow.</span>
        </footer>
      </main>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().email('Enter a valid university email.'),
  password: z.string().min(1, 'Enter your password.'),
});
function LoginForm({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [show, setShow] = useState(false),
    [error, setError] = useState<unknown>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });
  return (
    <form
      onSubmit={handleSubmit(async ({ email, password }) => {
        setError(null);
        try {
          await onLogin(email, password);
        } catch (e) {
          setError(e);
        }
      })}
    >
      <Field label="University email">
        <input
          type="email"
          placeholder="you@gutech.edu.pk"
          autoComplete="email"
          {...register('email')}
          aria-invalid={!!errors.email}
        />
      </Field>
      {errors.email && <p className="field-error">{errors.email.message}</p>}
      <Field label="Password">
        <div className="password-input">
          <input
            type={show ? 'text' : 'password'}
            placeholder="Enter your password"
            autoComplete="current-password"
            {...register('password')}
            aria-invalid={!!errors.password}
          />
          <button
            type="button"
            aria-label={show ? 'Hide password' : 'Show password'}
            onClick={() => setShow(!show)}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </Field>
      {errors.password && <p className="field-error">{errors.password.message}</p>}
      <div className="form-meta">
        <span>Secure campus access</span>
        <Link to="/forgot-password">Forgot password?</Link>
      </div>
      <ErrorBox error={error} />
      <button className="button primary submit" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in to portal'}
      </button>
    </form>
  );
}
