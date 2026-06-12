"use client";

import type { AnalyticsEventType } from "./types";

type ClientEventPayload = {
  trackId?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  properties?: Record<string, unknown>;
};

export function trackClientEvent(
  eventType: AnalyticsEventType,
  payload: ClientEventPayload = {}
): void {
  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventType, ...payload }),
    keepalive: true,
  }).catch(() => {});
}
