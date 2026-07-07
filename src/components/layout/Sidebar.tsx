import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NAV_LINKS } from './constants';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <nav
      className={`hidden shrink-0 border-r border-slate-800 bg-slate-900/50 py-6 lg:flex lg:flex-col transition-all duration-300 ${
        collapsed ? 'w-16 px-2' : 'w-64 px-4'
      }`}
    >
      <div className={`mb-8 flex items-center justify-between ${collapsed ? 'flex-col gap-4' : 'px-2'}`}>
        {!collapsed ? (
          <h1 className="text-2xl font-bold tracking-tight text-white">Lifestack</h1>
        ) : (
          <span className="text-xl font-bold tracking-wider text-cyan-400">L</span>
        )}
        <button
          onClick={onToggle}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto">
        {NAV_LINKS.map(({ to, label, testId, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              data-testid={testId}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon className={`shrink-0 ${collapsed ? 'h-5 w-5' : 'h-4 w-4 mr-3'}`} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
