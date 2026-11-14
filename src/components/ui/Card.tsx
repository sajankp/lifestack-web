import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const cardVariants = cva(
  'rounded-2xl border border-slate-700/50 bg-slate-800/30 shadow-lg shadow-black/10',
  {
    variants: {
      variant: {
        default: '',
        subtle: 'border-slate-700/30 bg-slate-800/20 shadow-none',
        accent: 'border-cyan-500/20 bg-cyan-500/5',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type CardProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>;

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
  ),
);
Card.displayName = 'Card';

type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>;
const CardHeader: React.FC<CardHeaderProps> = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-1.5', className)} {...props} />
);
CardHeader.displayName = 'CardHeader';

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement>;
const CardTitle: React.FC<CardTitleProps> = ({ className, ...props }) => (
  <h3 className={cn('font-semibold text-white text-base', className)} {...props} />
);
CardTitle.displayName = 'CardTitle';

type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;
const CardDescription: React.FC<CardDescriptionProps> = ({ className, ...props }) => (
  <p className={cn('text-xs text-slate-400', className)} {...props} />
);
CardDescription.displayName = 'CardDescription';

type CardContentProps = React.HTMLAttributes<HTMLDivElement>;
const CardContent: React.FC<CardContentProps> = ({ className, ...props }) => (
  <div className={cn('pt-1', className)} {...props} />
);
CardContent.displayName = 'CardContent';

type CardFooterProps = React.HTMLAttributes<HTMLDivElement>;
const CardFooter: React.FC<CardFooterProps> = ({ className, ...props }) => (
  <div
    className={cn(
      'mt-5 border-t border-slate-700/40 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3',
      className,
    )}
    {...props}
  />
);
CardFooter.displayName = 'CardFooter';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
