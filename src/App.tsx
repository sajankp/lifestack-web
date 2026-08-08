import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { useAuthStore } from './store/authStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { authService } from './services/auth';
import { onUnauthorized } from './services/api';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout, PageSkeleton } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';

const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const TodoPage = lazy(() => import('./pages/TodoPage').then((module) => ({ default: module.TodoPage })));
const HealthPage = lazy(() => import('./pages/HealthPage').then((module) => ({ default: module.HealthPage })));
const SpendingPage = lazy(() => import('./pages/SpendingPage').then((module) => ({ default: module.SpendingPage })));
const InvestingPage = lazy(() => import('./pages/InvestingPage').then((module) => ({ default: module.InvestingPage })));
const NetWorthPage = lazy(() => import('./pages/NetWorthPage').then((module) => ({ default: module.NetWorthPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })));
const WeeklySummariesPage = lazy(() => import('./pages/WeeklySummariesPage').then((module) => ({ default: module.WeeklySummariesPage })));
const ImportsPage = lazy(() => import('./pages/ImportsPage').then((module) => ({ default: module.ImportsPage })));
const ExportsPage = lazy(() => import('./pages/ExportsPage').then((module) => ({ default: module.ExportsPage })));
const MasterConfigPage = lazy(() => import('./pages/MasterConfigPage').then((module) => ({ default: module.MasterConfigPage })));
const McpAuthorizePage = lazy(() => import('./pages/McpAuthorizePage').then((module) => ({ default: module.McpAuthorizePage })));

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  const setAuthResolved = useAuthStore((state) => state.setAuthResolved);
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
          if (typeof navigator !== 'undefined' && !navigator.onLine && isAuthenticated) {
            // Keep the last known session while offline so the service-worker
            // app shell can show cached, read-only UI instead of redirecting
            // an authenticated user to a login screen.
            setAuthResolved(true);
          } else {
            clearSession();
            clearActiveWorkspace();
          }
        }
      }
    };

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [clearActiveWorkspace, clearSession, isAuthenticated, setAuthResolved, setSession]);

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
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
          <Route path="/mcp/authorize" element={<McpAuthorizePage />} />

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
            path="/health"
            element={
              <Layout>
                <HealthPage />
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
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
