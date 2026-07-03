import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import type { SortDir } from './format';

export const SortableHeader = ({
  children,
  col,
  activeCol,
  dir,
  onSort,
  className,
}: {
  children: React.ReactNode;
  col: string;
  activeCol: string;
  dir: SortDir;
  onSort: (col: string, dir: SortDir) => void;
  className?: string;
}) => {
  const isActive = activeCol === col;
  const nextDir: SortDir = isActive && dir === 'asc' ? 'desc' : 'asc';
  return (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:text-slate-200 transition-colors ${className ?? ''}`}
      onClick={() => onSort(col, nextDir)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </th>
  );
};

export const SummaryCard = ({
  label,
  value,
  icon,
  testId,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  testId?: string;
}) => (
  <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-5">
    <div className="mb-2 inline-flex rounded-xl bg-slate-700/60 p-2 text-slate-100">{icon}</div>
    <p className="text-sm text-slate-400">{label}</p>
    <p data-testid={testId} className="mt-2 text-2xl font-bold text-white">{value}</p>
  </div>
);
