import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TodoPage } from './pages/TodoPage';
import { SpendingPage } from './pages/SpendingPage';
import { InvestingPage } from './pages/InvestingPage';
import { useAuthStore } from './store/authStore';
import { authService } from './services/auth';
import { onUnauthorized } from './services/api';

import { Link } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);

  if (!isAuthResolved) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">Checking session...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
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
        </ul>
      </nav>
      <main className="flex-1 text-slate-100">
        {children}
      </main>
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
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
