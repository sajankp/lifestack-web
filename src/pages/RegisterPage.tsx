import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import axios from 'axios';
import { authService } from '../services/auth';

const getPasswordStrength = (value: string) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (score >= 4) return { label: 'Strong', color: 'bg-emerald-500' };
  if (score >= 3) return { label: 'Good', color: 'bg-cyan-500' };
  if (score >= 2) return { label: 'Fair', color: 'bg-amber-500' };
  return { label: 'Weak', color: 'bg-rose-500' };
};

const getPasswordStrengthWidth = (value: string) => {
  if (!value) return 0;

  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  return Math.max(25, score * 25);
};

export const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    email: false,
    username: false,
    password: false,
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const passwordStrength = getPasswordStrength(password);
  const passwordStrengthScore = password ? getPasswordStrengthWidth(password) / 25 : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({ email: false, username: false, password: false });
    setLoading(true);

    try {
      await authService.register(email, password, username);
      navigate('/login', { state: { message: 'Registration successful. Please log in.' } });
    } catch (err: unknown) {
      let status: number | undefined;
      let detail: unknown;
      let errors: unknown;
      if (axios.isAxiosError(err)) {
        status = err.response?.status;
        detail = err.response?.data?.detail;
        errors = err.response?.data?.errors;
      }

      type fieldType = 'email' | 'username' | 'password';

      let invalidFields: Array<fieldType> = [];
      if (Array.isArray(errors)) {
        const nextFieldErrors = { email: false, username: false, password: false };
        for (const item of errors) {
          const loc = (item as { loc?: unknown }).loc;
          if (!Array.isArray(loc) || loc.length < 2) continue;

          const source = loc[0];
          const field = loc[1];
          if (source !== 'body' || typeof field !== 'string') continue;

          if (['email', 'username', 'password'].includes(field)) {
            nextFieldErrors[field as fieldType] = true;
          }
        }
        setFieldErrors(nextFieldErrors);
        invalidFields = (Object.keys(nextFieldErrors) as Array<'email' | 'username' | 'password'>).filter(
          (field) => nextFieldErrors[field]
        );
      }

      // Normalize 409 / 422 errors to prevent username/email enumeration
      if (
        status === 409 ||
        (typeof detail === 'string' && /already (exists|in use|registered)/i.test(detail))
      ) {
        setError('Registration failed. Please check your details and try again.');
      } else if (invalidFields.length > 0) {
        setError(`Invalid fields: ${invalidFields.join(', ')}.`);
      } else {
        setError('Registration failed. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white tracking-tight">Lifestack</h2>
          <p className="mt-2 text-sm text-slate-400">Create a new account</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-500">{error}</p>
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => authService.loginWithGoogle()}
            disabled={loading}
            className="rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-sm font-medium text-white hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={() => authService.loginWithGithub()}
            disabled={loading}
            className="rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-sm font-medium text-white hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-slate-900/60 text-slate-400">Or continue with email</span>
          </div>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="register-email" className="sr-only">
                Email address
              </label>
              <input
                id="register-email"
                type="email"
                placeholder="Email address"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: false }));
                  }
                }}
                className={`w-full rounded-lg bg-slate-700/50 p-3.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 border focus:border-transparent transition-all ${fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-cyan-500'}`}
              />
            </div>
            <div>
              <label htmlFor="register-username" className="sr-only">
                Username
              </label>
              <input
                id="register-username"
                type="text"
                placeholder="Username"
                required
                minLength={3}
                maxLength={50}
                pattern="^[a-zA-Z0-9_\-]+$"
                title="3–50 characters. Letters, numbers, underscores and hyphens only."
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (fieldErrors.username) {
                    setFieldErrors((prev) => ({ ...prev, username: false }));
                  }
                }}
                className={`w-full rounded-lg bg-slate-700/50 p-3.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 border focus:border-transparent transition-all ${fieldErrors.username ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-cyan-500'}`}
              />
            </div>
            <div>
              <label htmlFor="register-password" className="sr-only">
                Password
              </label>
              <input
                id="register-password"
                type="password"
                placeholder="Password"
                required
                minLength={8}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldErrors.password) {
                    setFieldErrors((prev) => ({ ...prev, password: false }));
                  }
                }}
                className={`w-full rounded-lg bg-slate-700/50 p-3.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 border focus:border-transparent transition-all ${fieldErrors.password ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-cyan-500'}`}
              />
              <div className="mt-2 space-y-2">
                <p className="text-xs text-slate-400">
                  Use at least 8 characters with upper and lower case letters, a number, and a
                  symbol.
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="flex flex-1 gap-1"
                    role="meter"
                    aria-label="Password strength"
                    aria-valuemin={0}
                    aria-valuemax={4}
                    aria-valuenow={passwordStrengthScore}
                    aria-valuetext={password ? passwordStrength.label : 'Required'}
                  >
                    {[0, 1, 2, 3].map((segment) => (
                      <span
                        key={segment}
                        data-testid={`password-strength-segment-${segment + 1}`}
                        className={`h-2 flex-1 rounded-full transition-colors ${
                          segment < passwordStrengthScore ? passwordStrength.color : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-medium text-slate-300">
                    {password ? passwordStrength.label : 'Required'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-600 p-3.5 font-semibold text-white shadow-lg hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
