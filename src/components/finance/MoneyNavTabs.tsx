import React from 'react';
import { NavLink } from 'react-router';

const TABS = [
  { to: '/money', label: 'Activity', end: true },
  { to: '/money/accounts', label: 'Accounts', end: false },
  { to: '/money/budget', label: 'Budget', end: false },
  { to: '/money/spending', label: 'Spending', end: false },
];

export const MoneyNavTabs: React.FC = () => (
  <nav
    aria-label="Money sections"
    className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-800"
  >
    {TABS.map(({ to, label, end }) => (
      <NavLink
        key={to}
        to={to}
        end={end}
        data-testid={`money-tab-${label.toLowerCase()}`}
        className={({ isActive }) =>
          `shrink-0 border-b-2 px-3 py-2 text-sm font-medium ${
            isActive
              ? 'border-cyan-400 text-cyan-300'
              : 'border-transparent text-slate-400 hover:text-white'
          }`
        }
      >
        {label}
      </NavLink>
    ))}
  </nav>
);
