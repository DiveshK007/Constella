// PostHog product analytics — thin, safe wrapper around posthog-js.
//
// Initialised from NEXT_PUBLIC_POSTHOG_KEY. When the key is unset, every export
// here is a no-op, so analytics can be toggled purely by environment.
// posthog-js is imported dynamically inside the browser-only paths so it is
// never pulled into the static-export prerender (which runs in Node).

type PostHog = { capture: (event: string, properties?: Record<string, unknown>) => void };

let instance: PostHog | null = null;
let initializing: Promise<void> | null = null;

function enabled(): boolean {
  return typeof window !== "undefined" && Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function initPostHog(): Promise<void> {
  if (!enabled()) return Promise.resolve();
  if (initializing) return initializing;
  initializing = (async () => {
    try {
      const { default: posthog } = await import("posthog-js");
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: true,
        person_profiles: "identified_only",
      });
      instance = posthog as unknown as PostHog;
    } catch {
      /* analytics must never break the app */
    }
  })();
  return initializing;
}

/** Fire-and-forget event capture. Safe to call anywhere; no-op without a key. */
export function capture(event: string, properties?: Record<string, unknown>): void {
  if (!enabled()) return;
  void (async () => {
    try {
      if (!instance) await initPostHog();
      instance?.capture(event, properties);
    } catch {
      /* ignore */
    }
  })();
}
