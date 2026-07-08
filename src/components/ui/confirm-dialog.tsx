import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './dialog';
import { Button } from './button';

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isPending?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onConfirm: () => void;
};

/**
 * Shared confirm-before-destructive-action dialog. Use this for every delete
 * (or otherwise destructive) action instead of a one-off Radix dialog or,
 * worse, no confirmation at all.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  pendingLabel = 'Deleting…',
  cancelLabel = 'Cancel',
  destructive = true,
  isPending = false,
  isError = false,
  errorMessage = 'Something went wrong. Please try again.',
  onConfirm,
}) => {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isPending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className={destructive ? 'text-rose-300 hover:text-rose-200' : undefined}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        </DialogFooter>
        {isError && <p className="mt-2 text-sm text-rose-300">{errorMessage}</p>}
      </DialogContent>
    </Dialog>
  );
};
