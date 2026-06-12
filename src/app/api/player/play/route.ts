import { after, NextRequest, NextResponse } from "next/server";

import { resolveAnalyticsSessionId } from "@/lib/analytics/session";
import { trackEventAsync } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";
import { toPublicError } from "@/lib/security/errors";
import { getClientIp, isRateLimited } from "@/lib/security/rate-limit";
import { startUserPlayback } from "@/lib/spotify/client";
import { getSpotifySession } from "@/lib/spotify/session";
import { resolveAppUser } from "@/lib/users/resolve";

export async function POST(request: NextRequest) {
  const session = await getSpotifySession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateKey = session.spotifyUserId ?? getClientIp(request);
  if (await isRateLimited("play", rateKey, 60, 60)) {
    return NextResponse.json({ error: "Too many playback requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const uris = body?.uris as string[] | undefined;
  const deviceId = body?.deviceId as string | undefined;

  if (!uris?.length || uris.length > 1) {
    return NextResponse.json({ error: "Provide exactly one track URI" }, { status: 400 });
  }

  if (!uris[0]?.startsWith("spotify:track:")) {
    return NextResponse.json({ error: "Invalid track URI" }, { status: 400 });
  }

  try {
    await startUserPlayback(uris, deviceId);
    const appUser = await resolveAppUser();
    const analyticsSessionId = await resolveAnalyticsSessionId();

    after(() => {
      trackEventAsync(appUser?.id ?? null, ANALYTICS_EVENTS.PLAYBACK_STARTED, {
        sessionId: analyticsSessionId,
        trackId: body?.trackId ?? uris[0].replace("spotify:track:", ""),
        trackName: body?.trackName,
        artistName: body?.artistName,
        albumName: body?.albumName,
        properties: { source: "albumarc" },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: toPublicError(error, "Playback failed") },
      { status: 500 }
    );
  }
}
