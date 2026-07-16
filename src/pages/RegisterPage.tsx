import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const passwordStrengthWidth = getPasswordStrengthWidth(password);

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
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-700">
                    <div
                      className={`h-full transition-all ${passwordStrength.color}`}
                      style={{ width: `${passwordStrengthWidth}%` }}
                    />
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
