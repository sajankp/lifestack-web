import { NavLink } from 'react-router';
import { MoreHorizontal } from 'lucide-react';
import { NAV_LINKS } from './constants';

interface MobileBottomNavProps {
  onMore: () => void;
}

export function MobileBottomNav({ onMore }: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Primary navigation"
      data-testid="mobile-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-800 bg-slate-950/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden"
    >
      {NAV_LINKS.map(({ to, label, testId, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          data-testid={`${testId}-mobile-bottom`}
          className={({ isActive }) =>
            `flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium ${
              isActive ? 'text-cyan-300' : 'text-slate-400'
            }`
          }
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        aria-label="More"
        onClick={onMore}
        className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium text-slate-400"
      >
        <MoreHorizontal className="h-5 w-5" />
        <span>More</span>
      </button>
    </nav>
  );
}
