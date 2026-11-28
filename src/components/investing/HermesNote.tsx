import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, MessageSquareText } from 'lucide-react';
import { investingService } from '../../services/investing';
import { queryKeys } from '../../lib/queryKeys';
import { useActiveWorkspace } from '../../hooks/useActiveWorkspace';
import { formatDate } from '../../utils/dateFormat';
import { SimpleMarkdown } from '../ui/SimpleMarkdown';

/**
 * "Hermes note · <as_of>" (spec-113 §5.2): the actions note from the latest stored portfolio
 * report, collapsible. The list endpoint leaves `actions_md` out, so the newest report is read
 * once more with its payload. Renders nothing when there is no report or no note.
 */
export const HermesNote: React.FC = () => {
  const { activeWorkspaceId } = useActiveWorkspace(true);
  const [open, setOpen] = useState(true);

  const list = useQuery({
    queryKey: queryKeys.investing.portfolioReports.list({
      workspaceId: activeWorkspaceId ?? undefined,
      limit: 1,
    }),
    queryFn: () =>
      investingService.getPortfolioReports(activeWorkspaceId!, undefined, undefined, 1),
    enabled: !!activeWorkspaceId,
  });
  const latestId = list.data?.items?.[0]?.public_id;

  const detail = useQuery({
    queryKey: [...queryKeys.investing.portfolioReports.detail(latestId ?? ''), 'payload'],
    queryFn: () => investingService.getPortfolioReport(latestId!, true),
    enabled: !!latestId,
  });

  const report = detail.data;
  if (!report?.actions_md?.trim()) return null;

  return (
    <section
      className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-4"
      data-testid="hermes-note"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        data-testid="hermes-note-toggle"
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
          <MessageSquareText className="h-4 w-4 text-cyan-300" aria-hidden />
          Hermes note · {formatDate(report.as_of)}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? <SimpleMarkdown source={report.actions_md} className="mt-3" /> : null}
    </section>
  );
};
