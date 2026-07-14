import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import posthog from 'posthog-js';

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}));

describe('analytics (spec-081)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not initialize PostHog without VITE_POSTHOG_KEY', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { initAnalytics, trackEvent } = await import('./analytics');
    initAnalytics();
    trackEvent('login');

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('initializes PostHog with privacy-safe config when VITE_POSTHOG_KEY is set', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'test-key');
    const { initAnalytics } = await import('./analytics');
    initAnalytics();

    expect(posthog.init).toHaveBeenCalledTimes(1);
    const [key, config] = vi.mocked(posthog.init).mock.calls[0];
    expect(key).toBe('test-key');
    expect(config).toMatchObject({
      autocapture: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
      capture_exceptions: true,
    });
  });

  it('is idempotent — a second initAnalytics call does not re-init', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'test-key');
    const { initAnalytics } = await import('./analytics');
    initAnalytics();
    initAnalytics();

    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it('tracks explicit events with property-free payloads once initialized', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'test-key');
    const { initAnalytics, trackEvent } = await import('./analytics');
    initAnalytics();
    trackEvent('transfer_created');

    expect(posthog.capture).toHaveBeenCalledWith('transfer_created');
  });

  it('identifies by public id and resets on logout', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'test-key');
    const { initAnalytics, identifyUser, resetAnalyticsIdentity } = await import('./analytics');
    initAnalytics();
    identifyUser('user-public-id');
    resetAnalyticsIdentity();

    expect(posthog.identify).toHaveBeenCalledWith('user-public-id');
    expect(posthog.reset).toHaveBeenCalledTimes(1);
  });
});
