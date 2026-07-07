import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Building2, X } from 'lucide-react';
import type { WorkspaceInfo } from '../../services/platform';
import { NAV_LINKS, ROLE_BADGE } from './constants';

interface MobileNavDrawerProps {
  open: boolean;
  onClose: () => void;
  username: string;
  workspace?: WorkspaceInfo;
}

export function MobileNavDrawer({
  open,
  onClose,
  username,
  workspace,
}: MobileNavDrawerProps) {
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

        {/* Workspace pill */}
        {workspace && (
          <div className="mb-4 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
              <p className="text-xs text-slate-400 uppercase tracking-widest">Workspace</p>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-100">{workspace.name}</p>
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
        <ul className="flex-1 space-y-1 overflow-y-auto">
          {NAV_LINKS.map(({ to, label, testId }) => (
            <li key={to}>
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
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
