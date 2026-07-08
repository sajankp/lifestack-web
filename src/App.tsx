import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { TodoPage } from './pages/TodoPage';
import { SpendingPage } from './pages/SpendingPage';
import { InvestingPage } from './pages/InvestingPage';
import { NetWorthPage } from './pages/NetWorthPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { WeeklySummariesPage } from './pages/WeeklySummariesPage';
import { ImportsPage } from './pages/ImportsPage';
import { ExportsPage } from './pages/ExportsPage';
import { MasterConfigPage } from './pages/MasterConfigPage';
import { useAuthStore } from './store/authStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { authService } from './services/auth';
import { onUnauthorized } from './services/api';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/layout/Layout';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  const setSession = useAuthStore((state) => state.setSession);
  const clearSession = useAuthStore((state) => state.clearSession);
  const clearActiveWorkspace = useWorkspaceStore((state) => state.clearActiveWorkspace);

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
          clearActiveWorkspace();
        }
      }
    };

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [clearActiveWorkspace, clearSession, setSession]);

  useEffect(() => {
    return onUnauthorized(() => {
      clearSession();
      clearActiveWorkspace();
    });
  }, [clearActiveWorkspace, clearSession]);

  if (!isAuthResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-300">
        Loading...
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
            path="/forgot-password"
            element={isAuthenticated ? <Navigate to="/" replace /> : <ForgotPasswordPage />}
          />

          <Route
            path="/reset-password"
            element={isAuthenticated ? <Navigate to="/" replace /> : <ResetPasswordPage />}
          />

          <Route
            path="/"
            element={
              <Layout>
                <DashboardPage />
              </Layout>
            }
          />

          <Route
            path="/todo"
            element={
              <Layout>
                <TodoPage />
              </Layout>
            }
          />

          <Route
            path="/spending"
            element={
              <Layout>
                <SpendingPage />
              </Layout>
            }
          />
          <Route
            path="/investing"
            element={
              <Layout>
                <InvestingPage />
              </Layout>
            }
          />
          <Route
            path="/net-worth"
            element={
              <Layout>
                <NetWorthPage />
              </Layout>
            }
          />

          <Route
            path="/notifications"
            element={
              <Layout>
                <NotificationsPage />
              </Layout>
            }
          />
          <Route
            path="/summaries"
            element={
              <Layout>
                <WeeklySummariesPage />
              </Layout>
            }
          />
          <Route
            path="/imports"
            element={
              <Layout>
                <ImportsPage />
              </Layout>
            }
          />
          <Route
            path="/exports"
            element={
              <Layout>
                <ExportsPage />
              </Layout>
            }
          />
          <Route
            path="/settings"
            element={
              <Layout>
                <MasterConfigPage />
              </Layout>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
