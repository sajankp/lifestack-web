// PostHog analytics + error tracking (spec-081).
//
// Inert without VITE_POSTHOG_KEY — dev/test/e2e never set it, so init() is a
// no-op there and no events are ever sent. Privacy is binding (spec-081):
// autocapture off, session recording off, identified_only profiles, and
// every event name below is explicit — no financial values, captured text,
// or entity names ever go into event properties.
import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics(): void {
  const apiKey = import.meta.env.VITE_POSTHOG_KEY;
  if (!apiKey || initialized) {
    return;
  }
  initialized = true;
  posthog.init(apiKey, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: false,
    disable_session_recording: true,
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_exceptions: true,
  });
}

export function identifyUser(publicId: string): void {
  if (!initialized) return;
  posthog.identify(publicId);
}

export function resetAnalyticsIdentity(): void {
  if (!initialized) return;
  posthog.reset();
}

// Explicit event names only (spec-081 privacy gate) — event names + counts,
// never property payloads carrying amounts, captured text, or entity names.
export type AnalyticsEvent =
  | 'login'
  | 'import_completed'
  | 'transfer_created'
  | 'capture_session_started';

export function trackEvent(event: AnalyticsEvent): void {
  if (!initialized) return;
  posthog.capture(event);
}
