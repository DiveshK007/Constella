"use client";

import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/react";
import { initPostHog } from "@/lib/posthog";
import { initSentryClient } from "@/lib/sentry.client";

/**
 * Boots browser-side analytics/monitoring once on mount and renders Vercel
 * Analytics. PostHog and Sentry each self-disable when their env var is unset.
 */
export function AnalyticsProvider() {
  useEffect(() => {
    initPostHog();
    initSentryClient();
  }, []);

  return <Analytics />;
}
