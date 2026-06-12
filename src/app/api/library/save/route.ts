import { after, NextRequest, NextResponse } from "next/server";

import { resolveAnalyticsSessionId } from "@/lib/analytics/session";
import { trackEventAsync } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";
import { toPublicError } from "@/lib/security/errors";
import { getClientIp, isRateLimited } from "@/lib/security/rate-limit";
import { saveTrackToLibrary } from "@/lib/spotify/client";
import { getSpotifySession } from "@/lib/spotify/session";
import { resolveAppUser } from "@/lib/users/resolve";

export async function POST(request: NextRequest) {
  const session = await getSpotifySession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateKey = session.spotifyUserId ?? getClientIp(request);
  if (await isRateLimited("like", rateKey, 30, 60)) {
    return NextResponse.json({ error: "Too many like requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const trackUri = body.trackUri as string | undefined;

  if (!trackUri?.startsWith("spotify:track:")) {
    return NextResponse.json({ error: "Invalid track URI" }, { status: 400 });
  }

  try {
    await saveTrackToLibrary(trackUri);
    const appUser = await resolveAppUser();
    const analyticsSessionId = await resolveAnalyticsSessionId();

    after(() => {
      trackEventAsync(appUser?.id ?? null, ANALYTICS_EVENTS.TRACK_LIKED, {
        sessionId: analyticsSessionId,
        trackId: body.trackId ?? trackUri.replace("spotify:track:", ""),
        trackName: body.trackName,
        artistName: body.artistName,
        albumName: body.albumName,
      });
    });

    return NextResponse.json({ saved: true });
  } catch (error) {
    return NextResponse.json(
      { error: toPublicError(error, "Failed to save track") },
      { status: 500 }
    );
  }
}
