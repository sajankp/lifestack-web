import { useState } from 'react';
import { Navigate, Link, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Building2,
  ChevronDown,
  Menu,
  Plus,
  UserCircle2,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { authService } from '../../services/auth';
import { notificationsService } from '../../services/notifications';
import { VoiceAgentWidget } from '../VoiceAgentWidget';
import { useActiveWorkspace } from '../../hooks/useActiveWorkspace';
import { Sidebar } from './Sidebar';
import { MobileNavDrawer } from './MobileNavDrawer';
import { ROLE_BADGE } from './constants';
import { queryKeys } from '../../lib/queryKeys';

// --------------------------------------------------------------------------
// Route-level loading skeleton
// --------------------------------------------------------------------------

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5 p-6">
      <div className="h-8 w-48 rounded-xl bg-slate-800" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-slate-800" />
        ))}
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-slate-800" />
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Protected route wrapper (includes layout chrome)
// --------------------------------------------------------------------------

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const clearActiveWorkspace = useWorkspaceStore((state) => state.clearActiveWorkspace);
  const { data: unread } = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => notificationsService.unreadCount(),
    enabled: isAuthenticated && isAuthResolved,
    refetchInterval: 60_000,
  });
  const {
    activeWorkspace: workspace,
    workspaces,
    selectWorkspace,
    isSelectingWorkspace,
  } = useActiveWorkspace(isAuthenticated && isAuthResolved);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('lifestack:sidebar-collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('lifestack:sidebar-collapsed', String(next));
      } catch {
        // Ignore restricted storage environments.
      }
      return next;
    });
  };

  if (!isAuthResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <PageSkeleton />
      </div>
    );
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
      clearActiveWorkspace();
      setIsLoggingOut(false);
    }
  };

  const roleBadge = workspace?.role ? ROLE_BADGE[workspace.role] ?? ROLE_BADGE.viewer : null;

  return (
    <div className="flex min-h-screen bg-slate-900">
      {/* Desktop sidebar */}
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

      {/* Mobile nav drawer */}
      <MobileNavDrawer
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        username={user?.username ?? user?.email ?? 'You'}
        workspace={workspace}
        workspaces={workspaces}
        onSelectWorkspace={selectWorkspace}
        isSelectingWorkspace={isSelectingWorkspace}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />

      <main className="flex flex-1 flex-col text-slate-100 min-w-0">
        {/* Top header */}
        <header className="border-b border-slate-800/60 py-3">
          <div className="mx-auto w-full max-w-[var(--max-content-width)] px-[var(--page-padding-x)] flex items-center justify-between gap-3">
            {/* Left: hamburger (mobile) + workspace badge */}
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile hamburger */}
              <button
                data-testid="nav-mobile-open"
                onClick={() => setMobileNavOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>

              {/* Workspace badge */}
              {workspace ? (
                <div className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm">
                  <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  {workspaces.length > 1 ? (
                    <select
                      aria-label="Active workspace"
                      data-testid="header-workspace-select"
                      value={workspace.public_id}
                      onChange={(event) => selectWorkspace(event.target.value)}
                      disabled={isSelectingWorkspace}
                      className="max-w-[180px] bg-transparent text-sm font-semibold text-slate-100 outline-none"
                    >
                      {workspaces.map((item) => (
                        <option key={item.public_id} value={item.public_id} className="bg-slate-900">
                          {item.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="font-semibold text-slate-100 truncate max-w-[140px]">
                      {workspace.name}
                    </span>
                  )}
                  {roleBadge && (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleBadge}`}>
                      {workspace.role}
                    </span>
                  )}
                </div>
              ) : (
                <div className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-700/50 bg-slate-900 px-3 py-2 text-sm">
                  <div className="h-3.5 w-20 animate-pulse rounded bg-slate-800" />
                </div>
              )}

              {/* Quick-add shortcuts (≥lg only) */}
              <div className="hidden items-center gap-2 lg:flex">
                <Link
                  to="/todo?new=1"
                  data-testid="header-quick-todo"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Todo
                </Link>
                <Link
                  to="/spending?new=1"
                  data-testid="header-quick-spending"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Spending
                </Link>
              </div>
            </div>

            {/* Right: notifications + profile */}
            <div className="flex items-center gap-2 shrink-0">
              <NavLink
                to="/notifications"
                aria-label="Notifications"
                data-testid="header-notifications"
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
                  <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 text-center text-[10px] font-semibold text-white leading-[18px]">
                    {unread?.count}
                  </span>
                ) : null}
              </NavLink>

              {/* Profile dropdown (hidden on very small screens) */}
              <details className="relative hidden sm:block">
                <summary
                  data-testid="header-profile-menu"
                  className="list-none inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <UserCircle2 className="h-4 w-4 text-slate-400" />
                  <span className="max-w-[140px] truncate">{user?.username ?? user?.email ?? 'Profile'}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-700 bg-slate-900 p-2 shadow-2xl shadow-black/40">
                  <div className="mb-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Signed In</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-100">{user?.username ?? 'Profile'}</p>
                    <p className="truncate text-xs text-slate-400">{user?.email ?? ''}</p>
                    {workspace && (
                      <div className="mt-2 flex items-center gap-1.5 border-t border-slate-800 pt-2">
                        <Building2 className="h-3 w-3 text-slate-500 shrink-0" />
                        <span className="text-xs text-slate-400 truncate">{workspace.name}</span>
                        {roleBadge && (
                          <span className={`ml-auto shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${roleBadge}`}>
                            {workspace.role}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Link
                    to="/settings"
                    className="block rounded-lg px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    Settings
                  </Link>
                  <Link
                    to="/notifications"
                    className="block rounded-lg px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800 hover:text-white"
                  >
                    Notifications
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-60"
                  >
                    {isLoggingOut ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </details>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 min-w-0">{children}</div>
      </main>
      <VoiceAgentWidget />
    </div>
  );
};
