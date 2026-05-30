import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, LogOut, UserCircle2 } from 'lucide-react';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TodoPage } from './pages/TodoPage';
import { SpendingPage } from './pages/SpendingPage';
import { InvestingPage } from './pages/InvestingPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { WeeklySummariesPage } from './pages/WeeklySummariesPage';
import { ImportsPage } from './pages/ImportsPage';
import { MasterConfigPage } from './pages/MasterConfigPage';
import { useAuthStore } from './store/authStore';
import { authService } from './services/auth';
import { onUnauthorized } from './services/api';
import { notificationsService } from './services/notifications';
import { VoiceAgentWidget } from './components/VoiceAgentWidget';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsService.unreadCount(),
    enabled: isAuthenticated && isAuthResolved,
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!isAuthResolved) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">Checking session...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await authService.logout();
    } finally {
      clearSession();
      setIsLoggingOut(false);
    }
  };
  
  return (
    <div className="flex min-h-screen bg-slate-900">
      <nav className="w-64 border-r border-slate-800 bg-slate-900/50 p-6">
        <h1 className="mb-8 text-2xl font-bold text-white tracking-tight">Lifestack</h1>
        <ul className="space-y-4 text-slate-400">
          <li>
            <Link to="/" className="hover:text-white transition-colors">Dashboard</Link>
          </li>
          <li>
            <Link to="/todo" className="hover:text-white transition-colors">Todos</Link>
          </li>
          <li>
            <Link to="/spending" className="hover:text-white transition-colors">Spending</Link>
          </li>
          <li>
            <Link to="/investing" className="hover:text-white transition-colors">Investing</Link>
          </li>
          <li>
            <Link to="/summaries" className="hover:text-white transition-colors">Weekly Summaries</Link>
          </li>
          <li>
            <Link to="/imports" className="hover:text-white transition-colors">Bulk Imports</Link>
          </li>
          <li>
            <Link to="/settings" className="hover:text-white transition-colors">Master Config</Link>
          </li>
        </ul>
      </nav>
      <main className="flex flex-1 flex-col text-slate-100">
        <header className="flex items-center justify-between border-b border-slate-800/60 px-8 py-4">
          <div className="text-sm text-slate-400">
            Workspace
          </div>
          <div className="flex items-center gap-3">
            <NavLink
              to="/notifications"
              aria-label="Notifications"
              className={({ isActive }) =>
                `relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                  isActive
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
              {(unread?.count ?? 0) > 0 ? (
                <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold text-white">
                  {unread?.count}
                </span>
              ) : null}
            </NavLink>
            <div className="hidden items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 sm:inline-flex">
              <UserCircle2 className="h-4 w-4 text-slate-400" />
              <span className="max-w-[160px] truncate">{user?.username ?? user?.email ?? 'Profile'}</span>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
            </button>
          </div>
        </header>
        <div className="flex-1">
          {children}
        </div>
      </main>
      <VoiceAgentWidget />
    </div>
  );
};

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const hydrateSession = async () => {
      try {
        const user = await authService.checkAuth();
        if (!cancelled) {
          setSession(user);
        }
      } catch {
        if (!cancelled) {
          clearSession();
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [clearSession, setSession]);

  // When the refresh interceptor gives up (refresh token expired / revoked),
  // it fires the onUnauthorized event. We clear the session here so the
  // router redirects to /login without any component needing to catch 401s.
  useEffect(() => {
    return onUnauthorized(() => {
      clearSession();
    });
  }, [clearSession]);

  if (isBootstrapping && !isAuthResolved) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} 
        />
        
        <Route 
          path="/register" 
          element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} 
        />
        
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/todo" 
          element={
            <ProtectedRoute>
              <TodoPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/spending" 
          element={
            <ProtectedRoute>
              <SpendingPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/investing" 
          element={
            <ProtectedRoute>
              <InvestingPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/notifications" 
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/summaries" 
          element={
            <ProtectedRoute>
              <WeeklySummariesPage />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/imports"
          element={
            <ProtectedRoute>
              <ImportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <MasterConfigPage />
            </ProtectedRoute>
          }
        />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
