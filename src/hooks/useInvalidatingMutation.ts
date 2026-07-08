import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/ui/toast';

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Wraps useMutation and invalidates the given query keys on success.
 * Collapses the "mutate, then invalidate N query keys" boilerplate repeated
 * across page components into one call. Also the single choke point for
 * mutation success/error toasts — pass `successMessage`/`errorMessage` as
 * `false` to opt a call site out (e.g. when it renders its own feedback).
 */
export function useInvalidatingMutation<TArgs = void, TResult = unknown>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  invalidateKeys: readonly (readonly unknown[])[],
  options?: {
    onSuccess?: (result: TResult) => void;
    onError?: (error: unknown) => void;
    successMessage?: string | false;
    errorMessage?: string | false;
  },
) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  return useMutation({
    mutationFn,
    onSuccess: (result: TResult) => {
      // One key's invalidation failing must not skip the rest.
      for (const key of [...invalidateKeys]) {
        try {
          queryClient.invalidateQueries({ queryKey: [...key] });
        } catch (error) {
          console.error('useInvalidatingMutation: failed to invalidate query key', key, error);
        }
      }
      if (options?.successMessage !== false) {
        showToast(options?.successMessage ?? 'Saved', 'success');
      }
      options?.onSuccess?.(result);
    },
    onError: (error: unknown) => {
      if (options?.errorMessage !== false) {
        showToast(options?.errorMessage || extractErrorMessage(error), 'error');
      }
      options?.onError?.(error);
    },
  });
}
