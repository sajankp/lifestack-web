import React from 'react';
import { PieChart } from 'lucide-react';
import { toNumber } from '../../utils/numberFormat';
import type { ThemeWeight } from '../../types/investing';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/Card';

const ALLOCATION_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#64748b', // slate
];

const DONUT_RADIUS = 60;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
const GAP = 3;

interface ThemeSplitCardProps {
  themeWeights: ThemeWeight[];
}

interface Slice {
  theme: string;
  weight: number;
  pct: number;
  color: string;
}

export const ThemeSplitCard: React.FC<ThemeSplitCardProps> = ({ themeWeights }) => {
  const totalWeight = themeWeights.reduce((acc, t) => acc + toNumber(t.weight), 0);
  const hasData = totalWeight > 0;

  const slices: Slice[] = hasData
    ? themeWeights
        .filter((t) => toNumber(t.weight) > 0)
        .map((t, idx) => {
          const weight = toNumber(t.weight);
          return {
            theme: t.theme || 'Unclassified',
            weight,
            pct: (weight / totalWeight) * 100,
            color: ALLOCATION_COLORS[idx % ALLOCATION_COLORS.length],
          };
        })
        .sort((a, b) => b.pct - a.pct)
    : [];

  if (!hasData) {
    return (
      <Card data-testid="theme-split-card" className="p-5">
        <CardHeader>
          <CardTitle>Theme Split</CardTitle>
          <CardDescription>Portfolio weight by investment theme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-700/30 bg-slate-900/30 p-6 text-center text-xs text-slate-400">
            No theme weights
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="theme-split-card" className="p-5">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-500/10 p-2 text-purple-400">
            <PieChart className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Theme Split</CardTitle>
            <CardDescription>Portfolio weight by investment theme</CardDescription>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total weight
          </div>
          <div className="text-xl font-bold text-white">
            {totalWeight.toFixed(1)}%
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Donut Chart */}
          <div className="relative flex-shrink-0 h-44 w-44">
            <svg className="h-full w-full" viewBox="0 0 160 160">
              {(() => {
                return slices.reduce(
                  (acc: { circles: React.ReactNode[]; accumulatedPct: number }, slice) => {
                    const slicePct = slice.pct / 100;
                    const dash = Math.max(
                      0,
                      slicePct * CIRCUMFERENCE - (slices.length > 1 ? GAP : 0),
                    );
                    const offset = -(acc.accumulatedPct * CIRCUMFERENCE);
                    return {
                      circles: [
                        ...acc.circles,
                        (
                          <circle
                            key={slice.theme}
                            cx={80}
                            cy={80}
                            r={DONUT_RADIUS}
                            fill="transparent"
                            stroke={slice.color}
                            strokeWidth="16"
                            strokeDasharray={`${dash} ${CIRCUMFERENCE}`}
                            strokeDashoffset={offset}
                            transform="rotate(-90 80 80)"
                          >
                            <title>{`${slice.theme}: ${slice.pct.toFixed(1)}%`}</title>
                          </circle>
                        ),
                      ],
                      accumulatedPct: acc.accumulatedPct + slicePct,
                    };
                  },
                  { circles: [] as React.ReactNode[], accumulatedPct: 0 },
                ).circles;
              })()}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Total
              </span>
              <span className="text-sm font-extrabold text-white" data-testid="theme-total-pct">
                {totalWeight.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Theme Breakdown Rows */}
          <div className="w-full flex-1 space-y-2">
            {slices.map((slice) => (
              <div
                key={slice.theme}
                className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-900/40 border border-slate-800/60 hover:border-slate-700/60 transition-colors"
                data-testid={`theme-row-${slice.theme.replace(/\s+/g, '-')}`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate font-medium text-slate-200">{slice.theme}</span>
                </div>
                <div className="text-right flex-shrink-0 ml-3">
                  <span className="font-semibold text-white">{slice.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

