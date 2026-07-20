// Browser-side Sentry error monitoring.
//
// Initialised from NEXT_PUBLIC_SENTRY_DSN. A no-op when the DSN is unset. The
// app is a static export (no server runtime), so this covers client errors;
// @sentry/nextjs is imported dynamically to keep it out of the prerender pass.

let initialized = false;

export async function initSentryClient(): Promise<void> {
  if (initialized || typeof window === "undefined") return;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_STELLAR_NETWORK || "production",
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
    });
    initialized = true;
  } catch {
    /* monitoring must never break the app */
  }
}
