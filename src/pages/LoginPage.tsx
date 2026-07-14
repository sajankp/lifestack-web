import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';
import { identifyUser, trackEvent } from '../lib/analytics';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const stateMessage = location.state?.message;
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await authService.login(email, password);
      const user = await authService.checkAuth();
      setSession(user);
      if (user?.public_id) {
        identifyUser(user.public_id);
      }
      trackEvent('login');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      // Always show a generic message to prevent username/email enumeration
      let status: number | undefined;
      if (axios.isAxiosError(err)) {
        status = err.response?.status;
      }
      if (status === 401 || status === 403 || status === 422) {
        setError('Invalid credentials. Please check your email and password.');
      } else {
        setError('Sign in failed. Please try again.');
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
          <p className="mt-2 text-sm text-slate-400">Sign in to your account</p>
        </div>
        
        {stateMessage && !error && (
          <div className="rounded-md bg-emerald-500/10 p-4">
            <p className="text-sm font-medium text-emerald-500">{stateMessage}</p>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-500/10 p-4">
            <p className="text-sm font-medium text-red-500">{error}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="login-email" className="sr-only">
                Email address
              </label>
              <input 
                id="login-email"
                type="email" 
                placeholder="Email address" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-slate-700/50 p-3.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 border border-slate-600 focus:border-transparent focus:ring-cyan-500 transition-all"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="sr-only">
                Password
              </label>
              <input 
                id="login-password"
                type="password" 
                placeholder="Password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-700/50 p-3.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 border border-slate-600 focus:border-transparent focus:ring-cyan-500 transition-all"
              />
            </div>
            <div className="flex justify-end text-xs">
              <Link to="/forgot-password" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
                Forgot password?
              </Link>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-lg bg-cyan-600 p-3.5 font-semibold text-white shadow-lg hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-cyan-400 hover:text-cyan-300 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};
