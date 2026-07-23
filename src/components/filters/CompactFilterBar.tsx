import React from 'react';
import { Filter } from 'lucide-react';

type CompactFilterBarProps = {
  children: React.ReactNode;
  title?: string;
  onReset?: () => void;
  resetLabel?: string;
  className?: string;
  testId?: string;
};

type CompactFilterFieldProps = {
  label: string;
  children: React.ReactNode;
  className?: string;
};

export const CompactFilterBar: React.FC<CompactFilterBarProps> = ({
  children,
  title = 'Filters',
  onReset,
  resetLabel = 'Reset filters',
  className,
  testId,
}) => {
  const customClassName = className ? ` ${className}` : '';
  return (
    <div
      data-testid={testId}
      className={`rounded-2xl border border-slate-700/50 bg-slate-900/50 p-4 backdrop-blur-xl${customClassName}`}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex h-10 items-center gap-2 pr-1 text-sm font-medium text-slate-400">
          <Filter className="h-4 w-4" />
          <span>{title}</span>
        </div>
        {children}
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="h-10 rounded-xl border border-slate-700 px-4 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            {resetLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export const CompactFilterField: React.FC<CompactFilterFieldProps> = ({
  label,
  children,
  className,
}) => {
  const customClassName = className ? ` ${className}` : '';
  return (
    <div className={`min-w-[200px] flex-1${customClassName}`}>
      <p className="mb-1 text-xs text-slate-400">{label}</p>
      {children}
    </div>
  );
};
