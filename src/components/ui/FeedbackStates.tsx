import React from 'react';
import { Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Skeleton primitives & Rich Shimmer for route-level and section loading
// ---------------------------------------------------------------------------

export const SkeletonLine: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded bg-slate-800/80 ${className}`} />
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur ${className}`}>
    <div className="flex items-center justify-between mb-3">
      <SkeletonLine className="h-3.5 w-24" />
      <SkeletonLine className="h-7 w-7 rounded-lg" />
    </div>
    <SkeletonLine className="h-8 w-36 mb-2" />
    <SkeletonLine className="h-3 w-48" />
  </div>
);

export const SkeletonList: React.FC<{ rows?: number; className?: string }> = ({
  rows = 5,
  className = '',
}) => (
  <div className={`space-y-3 ${className}`}>
    {[...Array(rows)].map((_, i) => (
      <div key={i} className="animate-pulse rounded-xl border border-slate-800/80 bg-slate-900/60 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <SkeletonLine className="h-9 w-9 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1">
              <SkeletonLine className="h-3.5 w-44" />
              <SkeletonLine className="h-3 w-28" />
            </div>
          </div>
          <div className="text-right space-y-1.5 shrink-0">
            <SkeletonLine className="h-4 w-20" />
            <SkeletonLine className="h-3 w-12 ml-auto" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonStatGrid: React.FC<{ cols?: number; className?: string }> = ({
  cols = 3,
  className = '',
}) => (
  <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-${cols} ${className}`}>
    {[...Array(cols)].map((_, i) => (
      <SkeletonCard key={i} className="h-28" />
    ))}
  </div>
);

export const SkeletonTable: React.FC<{ rows?: number; cols?: number; className?: string }> = ({
  rows = 5,
  cols = 4,
  className = '',
}) => (
  <div className={`rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden backdrop-blur ${className}`}>
    <div className="border-b border-slate-800/80 bg-slate-950/40 p-3.5 flex items-center justify-between gap-4">
      {[...Array(cols)].map((_, i) => (
        <SkeletonLine key={i} className={`h-3.5 ${i === 0 ? 'w-32' : 'w-20'}`} />
      ))}
    </div>
    <div className="divide-y divide-slate-800/60 p-1">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="p-3.5 flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3 flex-1">
            <SkeletonLine className="h-4 w-32" />
            <SkeletonLine className="h-3 w-20" />
          </div>
          <SkeletonLine className="h-4 w-24 shrink-0" />
          <SkeletonLine className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  </div>
);

export const LoadingSpinner: React.FC<{
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ label = 'Loading...', size = 'md', className = '' }) => {
  const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center gap-2.5 ${className}`}>
      <Loader2 className={`${iconSize} animate-spin text-cyan-400`} />
      {label && <span className="text-xs font-medium text-slate-400 animate-pulse">{label}</span>}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Empty state — call-to-action style
// ---------------------------------------------------------------------------

type EmptyStateProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 px-6 py-16 text-center">
    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-800 text-slate-400">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
    <p className="mt-2 max-w-sm text-sm text-slate-400">{description}</p>
    {action && <div className="mt-6">{action}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Error state — dismissable banner
// ---------------------------------------------------------------------------

type ErrorBannerProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
};

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
}) => (
  <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4">
    <div className="flex items-start gap-3">
      <div className="mt-0.5 h-4 w-4 shrink-0 text-rose-400">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 5Zm0 6.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-rose-200">{title}</p>
        <p className="mt-0.5 text-sm text-rose-200/70">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
        >
          Retry
        </button>
      )}
    </div>
  </div>
);
