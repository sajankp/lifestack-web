import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/auth';

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
      navigate('/', { replace: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-slate-800 p-10 shadow-2xl">
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
              <input 
                type="email" 
                placeholder="Email address" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-slate-700/50 p-3.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 border border-slate-600 focus:border-transparent focus:ring-blue-500 transition-all"
              />
            </div>
            <div>
              <input 
                type="password" 
                placeholder="Password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-slate-700/50 p-3.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 border border-slate-600 focus:border-transparent focus:ring-blue-500 transition-all"
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3.5 font-semibold text-white shadow-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-400">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-blue-500 hover:text-blue-400 transition-colors">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};
