import { getDb } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { Logger } from "@/utils/logger";

import { buildEventProperties, type AnalyticsEventType, type AnalyticsPayload, type TrackContext } from "./types";

const logger = new Logger("Analytics");

export async function trackEvent(
  userId: string | null,
  eventType: AnalyticsEventType,
  payload: (AnalyticsPayload & TrackContext) = {}
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const { sessionId, trackId } = payload;

  try {
    await db.insert(analyticsEvents).values({
      userId: userId ?? undefined,
      sessionId,
      eventType,
      trackId,
      properties: buildEventProperties(payload),
    });
  } catch (error) {
    logger.warn("Failed to persist analytics event", { eventType, error });
  }
}

export function trackEventAsync(
  userId: string | null,
  eventType: AnalyticsEventType,
  payload: (AnalyticsPayload & TrackContext) = {}
): void {
  void trackEvent(userId, eventType, payload).catch(() => {});
}
