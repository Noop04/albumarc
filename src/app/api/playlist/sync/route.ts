import { after, NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { resolveAnalyticsSessionId } from "@/lib/analytics/session";
import { trackEventAsync } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";
import { isDatabaseConfigured } from "@/lib/db";
import { toPublicError } from "@/lib/security/errors";
import { getClientIp, isRateLimited } from "@/lib/security/rate-limit";
import { syncAlbumarcPlaylist } from "@/lib/spotify/playlists";
import { getSpotifySession } from "@/lib/spotify/session";
import { resolveAppUser } from "@/lib/users/resolve";

export async function POST(request: NextRequest) {
  const session = await getSpotifySession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateKey = session.spotifyUserId ?? getClientIp(request);
  if (await isRateLimited("playlist-sync", rateKey, 5, 60)) {
    return NextResponse.json({ error: "Too many sync requests. Please wait." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const trackUris = body?.trackUris as string[] | undefined;

  if (!trackUris?.length || trackUris.length > 50) {
    return NextResponse.json({ error: "Provide 1–50 track URIs" }, { status: 400 });
  }

  const validUris = trackUris.filter((uri) => uri.startsWith("spotify:track:"));
  if (validUris.length === 0) {
    return NextResponse.json({ error: "No valid Spotify track URIs" }, { status: 400 });
  }

  try {
    const appUser = await resolveAppUser();
    const result = await syncAlbumarcPlaylist(appUser?.id ?? null, validUris);

    if (appUser && !result.skipped) {
      const analyticsSessionId = await resolveAnalyticsSessionId();
      after(() => {
        trackEventAsync(appUser.id, ANALYTICS_EVENTS.PLAYLIST_SYNCED, {
          sessionId: analyticsSessionId,
          properties: {
            trackCount: result.trackCount,
            playlistId: result.playlistId,
          },
        });
      });
    }

    return NextResponse.json({
      synced: !result.skipped,
      skipped: result.skipped,
      playlistUrl: result.spotifyUrl,
      trackCount: result.trackCount,
      analyticsEnabled: isDatabaseConfigured(),
    });
  } catch (error) {
    Sentry.captureException(error);
    const rawMessage = error instanceof Error ? error.message : "";
    const message = toPublicError(error, "Playlist sync failed");
    const needsScope =
      message.toLowerCase().includes("reconnect") ||
      message.toLowerCase().includes("scope") ||
      rawMessage.includes("403");
    return NextResponse.json(
      {
        error: needsScope
          ? "Reconnect Spotify to grant playlist permissions."
          : message,
      },
      { status: needsScope ? 403 : 500 }
    );
  }
}
