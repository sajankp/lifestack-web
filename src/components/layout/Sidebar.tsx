import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NAV_LINKS, NAV_SECTIONS, SETTINGS_LINK } from './constants';
import { useCaptureStore } from '../../store/captureStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const setIsOpen = useCaptureStore((state) => state.setIsOpen);
  const navLinkClass = (isActive: boolean, collapsedState: boolean) =>
    `flex items-center rounded-lg py-2 text-sm font-medium transition-colors ${
      collapsedState ? 'justify-center px-0' : 'px-3'
    } ${isActive ? 'bg-cyan-500/10 text-cyan-300' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`;

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
      <div className="flex-1 space-y-4 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section}>
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {section}
              </p>
            )}
            <ul className="space-y-1">
              {NAV_LINKS.filter((link) => link.section === section).map(({ to, label, testId, icon: Icon }) => (
                <li key={to}>
                  {to === '/capture' ? (
                    <button
                      type="button"
                      data-testid={testId}
                      title={collapsed ? label : undefined}
                      className={`w-full bg-transparent text-left ${navLinkClass(false, collapsed)}`}
                      onClick={() => setIsOpen(true)}
                    >
                      <Icon className={`shrink-0 ${collapsed ? 'h-5 w-5' : 'h-4 w-4 mr-3'}`} />
                      {!collapsed && <span>{label}</span>}
                    </button>
                  ) : (
                    <NavLink
                      to={to}
                      end={to === '/'}
                      data-testid={testId}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) => navLinkClass(isActive, collapsed)}
                    >
                      <Icon className={`shrink-0 ${collapsed ? 'h-5 w-5' : 'h-4 w-4 mr-3'}`} />
                      {!collapsed && <span>{label}</span>}
                    </NavLink>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-slate-800 pt-4">
        <NavLink
          to={SETTINGS_LINK.to}
          data-testid={SETTINGS_LINK.testId}
          title={collapsed ? SETTINGS_LINK.label : undefined}
          className={({ isActive }) => navLinkClass(isActive, collapsed)}
        >
          <SETTINGS_LINK.icon className={`shrink-0 ${collapsed ? 'h-5 w-5' : 'h-4 w-4 mr-3'}`} />
          {!collapsed && <span>{SETTINGS_LINK.label}</span>}
        </NavLink>
      </div>
    </nav>
  );
}
