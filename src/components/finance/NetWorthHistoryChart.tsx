import React from 'react';
import { Link } from 'react-router';
import { AlertCircle, TrendingUp } from 'lucide-react';
import { formatCompactNumber, formatCurrency } from '../../utils/numberFormat';
import { formatDate, formatShortDate } from '../../utils/dateFormat';
import type { DisplayProfile } from '../../hooks/useDisplayProfile';
import type { ExcludedCurrency, NetWorthHistoryItem } from '../../types/finance';

export const StatusBanner: React.FC<{
  status: string;
  reportingCurrency: string | null;
  excludedCurrencies: ExcludedCurrency[];
}> = ({ status, reportingCurrency, excludedCurrencies }) => {
  if (status === 'ok' || status === 'empty') return null;

  let message: React.ReactNode = null;
  if (status === 'no_reporting_currency') {
    message = (
      <>
        Configure a reporting currency in{' '}
        <Link to="/settings/currency" className="font-semibold underline hover:text-amber-200">
          Settings
        </Link>{' '}
        to see converted totals across all accounts.
      </>
    );
  } else if (status === 'partial') {
    const missing = excludedCurrencies.map((c) => c.currency_code).join(', ');
    message = reportingCurrency
      ? missing
        ? `No FX rate for ${missing} to ${reportingCurrency} — totals below exclude ${missing} balances.`
        : `Some balances could not be converted to ${reportingCurrency} — FX rates may be missing for one or more currencies.`
      : 'Partial data available. Configure a reporting currency and FX rates for full totals.';
  }

  if (!message) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
};

export const NetWorthHistoryChart: React.FC<{
  history: NetWorthHistoryItem[] | undefined;
  currency: string | null;
  displayProfile: DisplayProfile;
}> = ({ history, currency, displayProfile }) => {
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  if (!history || history.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-8 text-center">
        <TrendingUp className="mx-auto mb-3 h-8 w-8 text-slate-500" />
        <h3 className="font-semibold text-slate-300">History builds from here</h3>
        <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
          We've started tracking your net worth today. Once daily snapshots accumulate, a stacked
          area trend chart will appear here.
        </p>
      </div>
    );
  }

  const width = 800;
  const height = 280;
  const paddingX = 40;
  const paddingY = 20;

  const points = history.map((item) => ({
    dateStr: item.snapshot_date,
    spending: item.spending_cash != null ? parseFloat(item.spending_cash) : 0,
    investing: item.investing_cash != null ? parseFloat(item.investing_cash) : 0,
    holdings: item.holdings_value != null ? parseFloat(item.holdings_value) : 0,
    total: parseFloat(item.total_net_worth || '0'),
    hasComponents:
      item.holdings_value != null && item.investing_cash != null && item.spending_cash != null,
    isUserProvided: item.source === 'user_provided',
    isRevised: item.data_revised,
  }));

  const maxVal = Math.max(...points.map((p) => p.total), 1);

  const getX = (index: number) => {
    return paddingX + (index / (points.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (val: number) => {
    const scale = (height - 2 * paddingY) / maxVal;
    return height - paddingY - val * scale;
  };

  const componentRuns: number[][] = [];
  let currentRun: number[] = [];
  points.forEach((p, i) => {
    if (p.hasComponents) {
      currentRun.push(i);
    } else if (currentRun.length > 0) {
      componentRuns.push(currentRun);
      currentRun = [];
    }
  });
  if (currentRun.length > 0) componentRuns.push(currentRun);

  const buildStackPaths = (indices: number[]) => {
    const path = (value: (p: (typeof points)[number]) => number) =>
      indices.map((i) => `${getX(i)},${getY(value(points[i]))}`).join(' L ');
    const area = (value: (p: (typeof points)[number]) => number) => {
      if (indices.length === 0) return '';
      const first = indices[0];
      const last = indices[indices.length - 1];
      return `M ${getX(first)},${height - paddingY} L ${path(value)} L ${getX(last)},${
        height - paddingY
      } Z`;
    };
    return {
      pathTotal: path((p) => p.total),
      areaTotal: area((p) => p.total),
      pathInvest: path((p) => p.spending + p.investing),
      areaInvest: area((p) => p.spending + p.investing),
      pathSpend: path((p) => p.spending),
      areaSpend: area((p) => p.spending),
    };
  };

  const stackSegments = componentRuns.map(buildStackPaths);
  const pathTotal = points.map((p, i) => `${getX(i)},${getY(p.total)}`).join(' L ');
  const formatShortValue = (val: number) => formatCompactNumber(val, displayProfile.locale);

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-800/30 p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
            Net worth history
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Stacked breakdown over time {currency ? `(${currency})` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>Holdings</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
            <span>Investing Cash</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
            <span>Spending Cash</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 bg-white" />
            <span className="text-slate-300">Total Net Worth</span>
          </div>
          {points.some((p) => p.isUserProvided) && (
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full border border-dashed border-amber-500 bg-slate-800" />
              <span className="text-amber-400">User-provided</span>
            </div>
          )}
          {points.some((p) => p.isRevised) && (
            <div className="flex items-center gap-1.5">
              <span className="text-rose-400">*</span>
              <span className="text-rose-400">Data later reverted</span>
            </div>
          )}
        </div>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          className="w-full min-w-[640px]"
          viewBox={`0 0 ${width} ${height}`}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="colorHoldings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorInvesting" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorSpending" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={getY(maxVal)}
            x2={width - paddingX}
            y2={getY(maxVal)}
            stroke="#334155"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={getY(maxVal / 2)}
            x2={width - paddingX}
            y2={getY(maxVal / 2)}
            stroke="#334155"
            strokeDasharray="3 3"
          />
          <line
            x1={paddingX}
            y1={height - paddingY}
            x2={width - paddingX}
            y2={height - paddingY}
            stroke="#334155"
          />

          {/* Value labels */}
          <text
            x={paddingX - 8}
            y={getY(maxVal) + 4}
            textAnchor="end"
            className="text-[10px] fill-slate-500 font-medium"
          >
            {formatShortValue(maxVal)}
          </text>
          <text
            x={paddingX - 8}
            y={getY(maxVal / 2) + 4}
            textAnchor="end"
            className="text-[10px] fill-slate-500 font-medium"
          >
            {formatShortValue(maxVal / 2)}
          </text>
          <text
            x={paddingX - 8}
            y={height - paddingY + 4}
            textAnchor="end"
            className="text-[10px] fill-slate-500 font-medium"
          >
            0
          </text>

          {/* Stacked Areas */}
          {stackSegments.map((seg, idx) => (
            <g key={idx}>
              <path d={seg.areaTotal} fill="url(#colorHoldings)" />
              <path d={seg.areaInvest} fill="url(#colorInvesting)" />
              <path d={seg.areaSpend} fill="url(#colorSpending)" />
              <path
                d={`M ${seg.pathTotal}`}
                fill="none"
                stroke="#10b981"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              <path
                d={`M ${seg.pathInvest}`}
                fill="none"
                stroke="#6366f1"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              <path
                d={`M ${seg.pathSpend}`}
                fill="none"
                stroke="#06b6d4"
                strokeWidth={1}
                strokeOpacity={0.5}
              />
            </g>
          ))}

          {/* White line on top for Total Net Worth */}
          <path d={`M ${pathTotal}`} fill="none" stroke="#ffffff" strokeWidth={2} />

          {/* Dot anchors */}
          {points.map((p, i) => {
            const titleParts: string[] = [];
            if (p.isUserProvided) titleParts.push(`User-provided${p.hasComponents ? '' : ' (total only)'}`);
            if (p.isRevised) titleParts.push('Includes data later reverted');
            return (
              <g key={i} className="group cursor-pointer">
                <circle
                  cx={getX(i)}
                  cy={getY(p.total)}
                  r={4}
                  fill={p.isUserProvided ? '#1e293b' : '#ffffff'}
                  stroke={p.isRevised ? '#fb7185' : p.isUserProvided ? '#f59e0b' : '#1e293b'}
                  strokeWidth={1.5}
                  strokeDasharray={p.isUserProvided ? '2 1.5' : undefined}
                >
                  {titleParts.length > 0 && (
                    <title>
                      {`${titleParts.join(' — ')} — ${formatShortDate(p.dateStr)}`}
                    </title>
                  )}
                </circle>
                {p.isRevised && (
                  <text
                    x={getX(i)}
                    y={getY(p.total) - 8}
                    textAnchor="middle"
                    className="text-[11px] fill-rose-400 font-bold"
                  >
                    *
                  </text>
                )}
              </g>
            );
          })}

          {/* X Axis Labels */}
          {points.length > 0 && (
            <>
              <text
                x={getX(0)}
                y={height - paddingY + 16}
                textAnchor="start"
                className="text-[10px] fill-slate-500 font-medium"
              >
                {formatShortDate(points[0].dateStr)}
              </text>
              {points.length > 2 && (
                <text
                  x={getX(Math.floor(points.length / 2))}
                  y={height - paddingY + 16}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-500 font-medium"
                >
                  {formatShortDate(points[Math.floor(points.length / 2)].dateStr)}
                </text>
              )}
              <text
                x={getX(points.length - 1)}
                y={height - paddingY + 16}
                textAnchor="end"
                className="text-[10px] fill-slate-500 font-medium"
              >
                {formatShortDate(points[points.length - 1].dateStr)}
              </text>
            </>
          )}

          {/* Hover tooltip */}
          {hoverIndex != null &&
            points[hoverIndex] != null &&
            (() => {
              const p = points[hoverIndex];
              const hx = getX(hoverIndex);
              const rows: { label: string; value: number; color: string }[] = [
                { label: 'Total', value: p.total, color: '#ffffff' },
              ];
              if (p.hasComponents) {
                rows.push(
                  { label: 'Holdings', value: p.holdings, color: '#10b981' },
                  { label: 'Investing cash', value: p.investing, color: '#6366f1' },
                  { label: 'Spending cash', value: p.spending, color: '#06b6d4' },
                );
              }
              const boxW = 190;
              const lineH = 18;
              const headH = 22;
              const warnH = p.isRevised ? 30 : 0;
              const boxH = headH + rows.length * lineH + warnH + 8;
              const placeRight = hx + 12 + boxW <= width - paddingX;
              const boxX = placeRight ? hx + 12 : hx - 12 - boxW;
              const boxY = Math.min(paddingY, height - paddingY - boxH);
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <line
                    x1={hx}
                    y1={paddingY}
                    x2={hx}
                    y2={height - paddingY}
                    stroke="#94a3b8"
                    strokeWidth={1}
                    strokeDasharray="4 3"
                    strokeOpacity={0.6}
                  />
                  <circle
                    cx={hx}
                    cy={getY(p.total)}
                    r={5.5}
                    fill={p.isUserProvided ? '#1e293b' : '#ffffff'}
                    stroke={p.isRevised ? '#fb7185' : p.isUserProvided ? '#f59e0b' : '#0ea5e9'}
                    strokeWidth={2}
                  />
                  <rect
                    x={boxX}
                    y={boxY}
                    width={boxW}
                    height={boxH}
                    rx={8}
                    fill="#0f172a"
                    stroke="#334155"
                    strokeWidth={1}
                    fillOpacity={0.97}
                  />
                  <text
                    x={boxX + 10}
                    y={boxY + 15}
                    className="text-[11px] fill-slate-300 font-semibold"
                  >
                    {formatDate(p.dateStr)}
                    {p.isUserProvided ? ' · user' : ''}
                  </text>
                  {rows.map((row, ri) => {
                    const ry = boxY + headH + ri * lineH;
                    return (
                      <g key={row.label}>
                        <rect
                          x={boxX + 10}
                          y={ry}
                          width={8}
                          height={8}
                          rx={2}
                          fill={row.color}
                          stroke={row.color === '#ffffff' ? '#64748b' : 'none'}
                          strokeWidth={0.5}
                        />
                        <text x={boxX + 24} y={ry + 8} className="text-[11px] fill-slate-400">
                          {row.label}
                        </text>
                        <text
                          x={boxX + boxW - 10}
                          y={ry + 8}
                          textAnchor="end"
                          className="text-[11px] fill-slate-100 font-medium"
                        >
                          {formatCurrency(
                            String(row.value),
                            currency,
                            displayProfile.currencyDisplay,
                            displayProfile.locale,
                            displayProfile.decimalPlaces,
                          )}
                        </text>
                      </g>
                    );
                  })}
                  {p.isRevised && (
                    <text
                      x={boxX + 10}
                      y={boxY + headH + rows.length * lineH + 16}
                      className="text-[10px] fill-rose-300"
                    >
                      <tspan x={boxX + 10} dy="0">* Includes data from an</tspan>
                      <tspan x={boxX + 10} dy="12">import later reverted</tspan>
                    </text>
                  )}
                </g>
              );
            })()}

          {/* Hit bands */}
          {points.map((_, i) => {
            const x = getX(i);
            const left = i === 0 ? 0 : (getX(i - 1) + x) / 2;
            const right = i === points.length - 1 ? width : (x + getX(i + 1)) / 2;
            return (
              <rect
                key={i}
                x={left}
                y={0}
                width={right - left}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHoverIndex(i)}
                onFocus={() => setHoverIndex(i)}
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
