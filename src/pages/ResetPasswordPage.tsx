import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { authService } from '../services/auth';

const getPasswordScore = (value: string) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
};

const getPasswordStrength = (score: number) => {
  if (score >= 4) return { label: 'Strong', color: 'bg-emerald-500' };
  if (score >= 3) return { label: 'Good', color: 'bg-cyan-500' };
  if (score >= 2) return { label: 'Fair', color: 'bg-amber-500' };
  return { label: 'Weak', color: 'bg-rose-500' };
};

const getErrorDetail = (err: unknown): string => {
  const detail = (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (typeof item === 'object' && item !== null && 'msg' in item ? item.msg : null))
      .filter((message): message is string => typeof message === 'string')
      .join(', ');
    return messages || 'Invalid input. Please check your password requirements.';
  }

  return 'Failed to reset password. The link may have expired or already been used.';
};

export const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || null;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const passwordScore = getPasswordScore(password);
  const passwordStrength = getPasswordStrength(passwordScore);
  const passwordStrengthWidth = password ? Math.max(25, passwordScore * 25) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid or missing password reset token.');
      return;
    }

    if (password.length < 8 || passwordScore < 3) {
      setError('Password is too weak. Please follow the strength guidelines.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      await authService.resetPassword(token, password);
      navigate('/login', {
        state: {
          message:
            'Your password has been successfully reset. Please sign in with your new password.',
        },
        replace: true,
      });
    } catch (err) {
      setError(getErrorDetail(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 sm:p-10 shadow-2xl backdrop-blur-xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white tracking-tight">Lifestack</h2>
          <p className="mt-2 text-sm text-slate-400">Set your new password</p>
        </div>

        {!token ? (
          <div className="space-y-4">
            <div className="rounded-md bg-red-500/10 p-4">
              <p className="text-sm font-medium text-red-500">
                Invalid reset link. Please request a new password reset link.
              </p>
            </div>
            <p className="text-center text-sm text-slate-400">
              <Link
                to="/forgot-password"
                className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Request reset link
              </Link>
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-md bg-red-500/10 p-4">
                <p className="text-sm font-medium text-red-500">{error}</p>
              </div>
            )}

            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="reset-password" className="sr-only">
                    New Password
                  </label>
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="New Password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg bg-slate-700/50 p-3.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 border border-slate-600 focus:border-transparent focus:ring-cyan-500 transition-all"
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

                <div>
                  <label htmlFor="confirm-password" className="sr-only">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Confirm New Password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg bg-slate-700/50 p-3.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 border border-slate-600 focus:border-transparent focus:ring-cyan-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-cyan-600 p-3.5 font-semibold text-white shadow-lg hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50"
              >
                {loading ? 'Resetting password...' : 'Reset Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
