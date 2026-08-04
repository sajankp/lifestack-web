import { useAuthStore } from '../store/authStore';
import { resolveEffectiveTimezone } from '../utils/timezone';

export const useEffectiveTimezone = (): string => {
  const savedTimezone = useAuthStore((state) => state.user?.timezone);
  return resolveEffectiveTimezone(savedTimezone);
};
