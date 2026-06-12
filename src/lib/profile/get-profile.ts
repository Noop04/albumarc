import { and, eq, gte, inArray } from "drizzle-orm";

import { getCachedProfile, setCachedProfile, type MusicProfile } from "@/lib/cache/profile";
import { getDb } from "@/lib/db";
import { analyticsEvents } from "@/lib/db/schema";
import { getFeedbackSignals } from "@/lib/recommendations/feedback";
import { getRecentRecommendationCount } from "@/lib/recommendations/history";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";
import { aggregateTopCategories } from "@/lib/profile/categories";
import { getLikedTracksCount, getTopArtists, getTopTracks } from "@/lib/spotify/client";
import { getSpotifySession } from "@/lib/spotify/session";

export async function getMusicProfile(appUserId: string): Promise<MusicProfile> {
  const cached = await getCachedProfile(appUserId);
  if (cached) return cached;

  const session = await getSpotifySession();
  const [topArtistsResult, topTracksResult, likedTracksCount, feedback, prevRecommended] =
    await Promise.all([
      getTopArtists(10),
      getTopTracks(10),
      getLikedTracksCount(),
      getFeedbackSignals(appUserId),
      getRecentRecommendationCount(appUserId),
    ]);

  const db = getDb();
  let skipsLast30Days = feedback.skippedTrackIds.size;
  let likesLast30Days = feedback.likedTrackIds.size;

  if (db) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const counts = await db
      .select({ eventType: analyticsEvents.eventType })
      .from(analyticsEvents)
      .where(
        and(
          eq(analyticsEvents.userId, appUserId),
          gte(analyticsEvents.createdAt, since),
          inArray(analyticsEvents.eventType, [
            ANALYTICS_EVENTS.PLAYBACK_SKIPPED_NEXT,
            ANALYTICS_EVENTS.TRACK_LIKED,
          ])
        )
      );

    skipsLast30Days = counts.filter(
      (c) => c.eventType === ANALYTICS_EVENTS.PLAYBACK_SKIPPED_NEXT
    ).length;
    likesLast30Days = counts.filter((c) => c.eventType === ANALYTICS_EVENTS.TRACK_LIKED).length;
  }

  const topArtists = topArtistsResult.items.map((artist) => ({
      id: artist.id,
      name: artist.name,
      imageUrl: artist.images?.[0]?.url,
      genres: artist.genres ?? [],
    }));

  const profile: MusicProfile = {
    displayName: session?.displayName ?? null,
    imageUrl: session?.imageUrl,
    topCategories: aggregateTopCategories(topArtists),
    topArtists,
    topTracks: topTracksResult.items.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      imageUrl: track.album.images?.[0]?.url,
    })),
    stats: {
      likedTracksSampled: likedTracksCount,
      previouslyRecommended: prevRecommended,
      skipsLast30Days,
      likesLast30Days,
    },
    fetchedAt: new Date().toISOString(),
  };

  await setCachedProfile(appUserId, profile);
  return profile;
}
