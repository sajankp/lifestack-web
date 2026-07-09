import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-cyan-600 px-4 py-3 text-white shadow-lg shadow-cyan-500/20 hover:bg-cyan-500 hover:shadow-cyan-500/40',
        secondary: 'bg-slate-800 px-4 py-3 text-slate-200 hover:bg-slate-700',
        ghost: 'px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white',
        destructive:
          'bg-red-600 px-4 py-3 text-white shadow-lg shadow-red-500/20 hover:bg-red-500 hover:shadow-red-500/40',
      },
      size: {
        default: '',
        sm: 'px-3 py-2 text-sm',
        icon: 'h-10 w-10 rounded-lg p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a spinner, appends an ellipsis to string children, and disables the button. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    // Slot (asChild) forwards props onto a single child element it clones — passing it the
    // spinner and text as two children crashes at runtime, so the loading treatment only
    // applies when rendering a plain <button>.
    const content = !asChild && loading && typeof children === 'string' ? `${children}…` : children;
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {!asChild && loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {content}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button };
