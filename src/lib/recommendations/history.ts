import { and, eq, gte } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { recommendationHistory } from "@/lib/db/schema";

const HISTORY_DAYS = 30;

export async function getPreviouslyRecommendedTrackIds(userId: string): Promise<Set<string>> {
  const db = getDb();
  if (!db) return new Set();

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ trackId: recommendationHistory.trackId })
    .from(recommendationHistory)
    .where(
      and(
        eq(recommendationHistory.userId, userId),
        gte(recommendationHistory.recommendedAt, since)
      )
    );

  return new Set(rows.map((row) => row.trackId));
}

export async function saveRecommendationHistory(
  userId: string,
  trackIds: string[]
): Promise<void> {
  const db = getDb();
  if (!db || trackIds.length === 0) return;

  await db.insert(recommendationHistory).values(
    trackIds.map((trackId) => ({
      userId,
      trackId,
    }))
  );
}

export async function getRecentRecommendationCount(userId: string): Promise<number> {
  const db = getDb();
  if (!db) return 0;

  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({ trackId: recommendationHistory.trackId })
    .from(recommendationHistory)
    .where(
      and(
        eq(recommendationHistory.userId, userId),
        gte(recommendationHistory.recommendedAt, since)
      )
    );

  return new Set(rows.map((r) => r.trackId)).size;
}
