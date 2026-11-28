import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import { useAuthStore } from './store/authStore';
import { useWorkspaceStore } from './store/workspaceStore';
import { authService } from './services/auth';
import { onUnauthorized } from './services/api';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout, PageSkeleton } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';

const SubpathRedirect: React.FC<{ from: string; to: string }> = ({ from, to }) => {
  const location = useLocation();
  const subpath = location.pathname.slice(from.length);
  return <Navigate to={`${to}${subpath}${location.search}`} replace />;
};

const LegacySpendingRedirect: React.FC = () => {
  const location = useLocation();
  const legacyTab = new URLSearchParams(location.search).get('tab');
  const target =
    location.pathname === '/spending/analytics' || legacyTab === 'analytics'
      ? '/money/spending'
      : '/money/budget';
  return <Navigate to={target} replace />;
};

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })),
);
const TodoPage = lazy(() =>
  import('./pages/TodoPage').then((module) => ({ default: module.TodoPage })),
);
const HealthPage = lazy(() =>
  import('./pages/HealthPage').then((module) => ({ default: module.HealthPage })),
);
const MoneyFlowPage = lazy(() =>
  import('./pages/MoneyFlowPage').then((module) => ({ default: module.MoneyFlowPage })),
);
const SpendingPage = lazy(() =>
  import('./pages/SpendingPage').then((module) => ({ default: module.SpendingPage })),
);
const PortfolioPage = lazy(() =>
  import('./pages/PortfolioPage').then((module) => ({ default: module.PortfolioPage })),
);
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((module) => ({ default: module.NotificationsPage })),
);
const ImportsPage = lazy(() =>
  import('./pages/ImportsPage').then((module) => ({ default: module.ImportsPage })),
);
const ExportsPage = lazy(() =>
  import('./pages/ExportsPage').then((module) => ({ default: module.ExportsPage })),
);
const DataPage = lazy(() =>
  import('./pages/DataPage').then((module) => ({ default: module.DataPage })),
);
const MasterConfigPage = lazy(() =>
  import('./pages/MasterConfigPage').then((module) => ({ default: module.MasterConfigPage })),
);
const McpAuthorizePage = lazy(() =>
  import('./pages/McpAuthorizePage').then((module) => ({ default: module.McpAuthorizePage })),
);

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
              path="/todo/*"
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
              path="/money/budget"
              element={
                <Layout>
                  <SpendingPage />
                </Layout>
              }
            />
            <Route
              path="/money/spending"
              element={
                <Layout>
                  <SpendingPage />
                </Layout>
              }
            />
            <Route
              path="/money/*"
              element={
                <Layout>
                  <MoneyFlowPage />
                </Layout>
              }
            />
            <Route path="/spending/*" element={<LegacySpendingRedirect />} />

            <Route
              path="/portfolio/*"
              element={
                <Layout>
                  <PortfolioPage />
                </Layout>
              }
            />
            <Route
              path="/investing/*"
              element={<SubpathRedirect from="/investing" to="/portfolio" />}
            />

            <Route
              path="/notifications"
              element={
                <Layout>
                  <NotificationsPage />
                </Layout>
              }
            />
            <Route path="/net-worth" element={<Navigate to="/money/accounts" replace />} />
            <Route path="/summaries" element={<Navigate to="/?period=week" replace />} />
            <Route path="/imports/*" element={<Navigate to="/settings/data" replace />} />
            <Route path="/exports" element={<Navigate to="/settings/data" replace />} />
            <Route
              path="/settings/data"
              element={
                <Layout>
                  <DataPage />
                </Layout>
              }
            />
            <Route
              path="/settings/data/imports/*"
              element={
                <Layout>
                  <ImportsPage />
                </Layout>
              }
            />
            <Route
              path="/settings/data/exports"
              element={
                <Layout>
                  <ExportsPage />
                </Layout>
              }
            />
            <Route
              path="/settings/*"
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
