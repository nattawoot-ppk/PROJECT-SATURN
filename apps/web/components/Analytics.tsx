"use client";
import { useEffect } from "react";

/** Product analytics (PostHog, EU host by default). Loads only when NEXT_PUBLIC_POSTHOG_KEY is set and the visitor has not opted out. */
export function Analytics() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY; if (!key) return;
    try { if (localStorage.getItem("saturn.analytics.optout") === "1") return; } catch { /* ignore */ }
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, { api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com", person_profiles: "identified_only", capture_pageview: true, autocapture: false, persistence: "localStorage+cookie" });
    }).catch(() => {});
  }, []);
  return null;
}
