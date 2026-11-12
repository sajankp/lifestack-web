import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider',
  {
    variants: {
      variant: {
        default: 'border-slate-600 bg-slate-800/60 text-slate-300',
        secondary: 'border-slate-700/50 bg-slate-900/80 text-slate-400',
        success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
        caution: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
        critical: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
        outline: 'border-slate-600/50 bg-transparent text-slate-400',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge: React.FC<BadgeProps> = ({ className, variant, ...props }) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);
Badge.displayName = 'Badge';

export { Badge };
