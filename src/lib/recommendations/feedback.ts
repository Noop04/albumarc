import { and, eq, gte, inArray, sql } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";

export type FeedbackSignals = {
  skippedTrackIds: Set<string>;
  likedTrackIds: Set<string>;
  skippedArtists: Map<string, number>;
  likedArtists: Map<string, number>;
};

const LOOKBACK_DAYS = 30;

export async function getFeedbackSignals(userId: string): Promise<FeedbackSignals> {
  const db = getDb();
  const empty: FeedbackSignals = {
    skippedTrackIds: new Set(),
    likedTrackIds: new Set(),
    skippedArtists: new Map(),
    likedArtists: new Map(),
  };

  if (!db) return empty;

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const events = await db
    .select({
      eventType: analyticsEvents.eventType,
      trackId: analyticsEvents.trackId,
      properties: analyticsEvents.properties,
    })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.userId, userId),
        gte(analyticsEvents.createdAt, since),
        inArray(analyticsEvents.eventType, [
          ANALYTICS_EVENTS.PLAYBACK_SKIPPED_NEXT,
          ANALYTICS_EVENTS.PLAYBACK_SKIPPED_PREV,
          ANALYTICS_EVENTS.TRACK_LIKED,
        ])
      )
    )
    .orderBy(sql`${analyticsEvents.createdAt} DESC`)
    .limit(500);

  const skippedTrackIds = new Set<string>();
  const likedTrackIds = new Set<string>();
  const skippedArtists = new Map<string, number>();
  const likedArtists = new Map<string, number>();

  for (const event of events) {
    const props = event.properties as Record<string, unknown>;
    const artistName = typeof props.artistName === "string" ? props.artistName : null;

    if (
      event.eventType === ANALYTICS_EVENTS.PLAYBACK_SKIPPED_NEXT ||
      event.eventType === ANALYTICS_EVENTS.PLAYBACK_SKIPPED_PREV
    ) {
      if (event.trackId) skippedTrackIds.add(event.trackId);
      if (artistName) {
        skippedArtists.set(artistName, (skippedArtists.get(artistName) ?? 0) + 1);
      }
    }

    if (event.eventType === ANALYTICS_EVENTS.TRACK_LIKED) {
      if (event.trackId) likedTrackIds.add(event.trackId);
      if (artistName) {
        likedArtists.set(artistName, (likedArtists.get(artistName) ?? 0) + 1);
      }
    }
  }

  return { skippedTrackIds, likedTrackIds, skippedArtists, likedArtists };
}

export { applyFeedbackToScore } from "./scoring";
