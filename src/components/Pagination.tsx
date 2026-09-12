import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (newOffset: number) => void;
  pageSizeOptions?: number[];
  onLimitChange?: (newLimit: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  total,
  limit,
  offset,
  onPageChange,
  pageSizeOptions = [25, 50, 100, 200],
  onLimitChange,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  // If there's no data, or if there's only 1 page and page size cannot be changed, don't render.
  if (total === 0 || (totalPages <= 1 && !onLimitChange)) return null;

  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);

  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = Number(e.target.value);
    if (onLimitChange) {
      onLimitChange(newLimit);
      // Reset to first page when page size changes
      onPageChange(0);
    }
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-700/50 pt-4 mt-6">
      <p className="text-sm text-slate-400" data-testid="pagination-summary">
        Showing <span className="font-medium text-white">{start}</span> to{' '}
        <span className="font-medium text-white">{end}</span> of{' '}
        <span className="font-medium text-white">{total}</span> results
      </p>

      <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
        {onLimitChange && (
          <div className="flex items-center gap-2">
            <label htmlFor="pagination-page-size" className="text-xs text-slate-400 whitespace-nowrap">
              Rows per page:
            </label>
            <select
              id="pagination-page-size"
              data-testid="pagination-page-size-select"
              value={limit}
              onChange={handleLimitChange}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-200 hover:border-slate-600 focus:border-cyan-500 focus:outline-none transition-colors cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              aria-label="Previous page"
              data-testid="pagination-prev-btn"
              onClick={() => onPageChange(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              aria-label="Next page"
              data-testid="pagination-next-btn"
              onClick={() => onPageChange(offset + limit)}
              disabled={offset + limit >= total}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
