import { and, eq, gte, isNotNull, isNull } from "drizzle-orm";

import { trackEventAsync } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";
import { setCachedRecommendations } from "@/lib/cache/recommendations";
import { getDb } from "@/lib/db";
import { appUsers } from "@/lib/db/schema";
import { getPersonalizedRecommendations } from "@/lib/recommendations";
import { refreshAccessToken } from "@/lib/spotify/auth";
import { SpotifyTokenRevokedError } from "@/lib/spotify/auth-errors";
import { withUserToken } from "@/lib/spotify/client";
import { syncAlbumarcPlaylist } from "@/lib/spotify/playlists";
import { getUserRefreshToken } from "@/lib/users/tokens";
import { Logger } from "@/utils/logger";

const logger = new Logger("Cron:RefreshPlaylists");

const ACTIVE_DAYS = 14;

async function markUserDisconnected(userId: string): Promise<void> {
  const db = getDb();
  if (!db) return;

  const now = new Date();
  await db
    .update(appUsers)
    .set({ spotifyDisconnectedAt: now, updatedAt: now })
    .where(and(eq(appUsers.id, userId), isNull(appUsers.spotifyDisconnectedAt)));

  trackEventAsync(userId, ANALYTICS_EVENTS.AUTH_TOKEN_REVOKED, {
    properties: { source: "cron" },
  });
}

export async function refreshStalePlaylists(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const db = getDb();
  if (!db) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const activeSince = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);

  const users = await db
    .select({ id: appUsers.id })
    .from(appUsers)
    .where(
      and(
        gte(appUsers.lastSeenAt, activeSince),
        isNotNull(appUsers.encryptedRefreshToken),
        isNull(appUsers.spotifyDisconnectedAt)
      )
    )
    .limit(50);

  let succeeded = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const refreshToken = await getUserRefreshToken(user.id);
      if (!refreshToken) continue;

      const tokens = await refreshAccessToken(refreshToken);
      await withUserToken(tokens.access_token, async () => {
        const data = await getPersonalizedRecommendations(user.id);
        await setCachedRecommendations(user.id, data);
        await syncAlbumarcPlaylist(
          user.id,
          data.recommendations.map((track) => track.uri)
        );
      });
      succeeded += 1;
    } catch (error) {
      if (error instanceof SpotifyTokenRevokedError) {
        await markUserDisconnected(user.id);
      }
      failed += 1;
      logger.warn("Failed to refresh playlist for user", {
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Playlist refresh cron completed", {
    processed: users.length,
    succeeded,
    failed,
  });

  return { processed: users.length, succeeded, failed };
}
