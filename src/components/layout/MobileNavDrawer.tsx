import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Building2, LogOut, X } from 'lucide-react';
import type { WorkspaceInfo } from '../../services/platform';
import { NAV_LINKS, NAV_SECTIONS, ROLE_BADGE, SETTINGS_LINK } from './constants';
import { useCaptureStore } from '../../store/captureStore';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  username: string;
  workspace?: WorkspaceInfo;
  workspaces: WorkspaceInfo[];
  onSelectWorkspace: (workspaceId: string) => void;
  isSelectingWorkspace: boolean;
  onLogout: () => void;
  isLoggingOut: boolean;
}

export function MobileNavDrawer({
  open,
  onClose,
  username,
  workspace,
  workspaces,
  onSelectWorkspace,
  isSelectingWorkspace,
  onLogout,
  isLoggingOut,
}: MobileNavDrawerProps) {
  const setIsOpen = useCaptureStore((state) => state.setIsOpen);
  // Trap scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const roleBadge = workspace?.role ? ROLE_BADGE[workspace.role] ?? ROLE_BADGE.viewer : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-700 bg-slate-900 p-6 shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Mobile navigation"
      >
        {/* Header row */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white">Lifestack</h1>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Workspace switcher */}
        {workspace && (
          <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <p className="text-xs text-slate-400 uppercase tracking-widest">Workspace</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              {workspaces.length > 1 ? (
                <select
                  aria-label="Active workspace"
                  data-testid="mobile-workspace-select"
                  value={workspace.public_id}
                  onChange={(event) => onSelectWorkspace(event.target.value)}
                  disabled={isSelectingWorkspace}
                  className="w-full bg-transparent text-sm font-semibold text-slate-100 outline-none"
                >
                  {workspaces.map((item) => (
                    <option key={item.public_id} value={item.public_id} className="bg-slate-900">
                      {item.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="truncate text-sm font-semibold text-slate-100">{workspace.name}</p>
              )}
              {roleBadge && (
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${roleBadge}`}>
                  {workspace.role}
                </span>
              )}
            </div>
          </div>
        )}

        {/* User pill */}
        <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Signed in as</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{username}</p>
        </div>

        {/* Links */}
        <div className="flex-1 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section}>
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {section}
              </p>
              <ul className="space-y-1">
                {NAV_LINKS.filter((link) => link.section === section).map(({ to, label, testId }) => (
                  <li key={to}>
                    {to === '/capture' ? (
                      <button
                        type="button"
                        data-testid={`${testId}-mobile`}
                        onClick={() => {
                          onClose();
                          setIsOpen(true);
                        }}
                        className="block w-full rounded-lg bg-transparent px-3 py-2.5 text-left text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                      >
                        {label}
                      </button>
                    ) : (
                      <NavLink
                        to={to}
                        end={to === '/'}
                        data-testid={`${testId}-mobile`}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-cyan-500/10 text-cyan-300'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`
                        }
                      >
                        {label}
                      </NavLink>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Settings + logout, pinned at the bottom */}
        <div className="mt-4 space-y-1 border-t border-slate-800 pt-4">
          <NavLink
            to={SETTINGS_LINK.to}
            data-testid={`${SETTINGS_LINK.testId}-mobile`}
            onClick={onClose}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            {SETTINGS_LINK.label}
          </NavLink>
          <button
            type="button"
            data-testid="mobile-logout"
            onClick={onLogout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </>
  );
}
