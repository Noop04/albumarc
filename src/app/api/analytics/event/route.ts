import { NextRequest, NextResponse } from "next/server";

import { resolveAnalyticsSessionId } from "@/lib/analytics/session";
import { trackEventAsync } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS, type AnalyticsEventType } from "@/lib/analytics/types";
import { isDatabaseConfigured } from "@/lib/db";
import { getClientIp, isRateLimited } from "@/lib/security/rate-limit";
import { getSpotifySession } from "@/lib/spotify/session";
import { resolveAppUser } from "@/lib/users/resolve";

const CLIENT_ALLOWED_EVENTS = new Set<string>([
  ANALYTICS_EVENTS.PLAYBACK_SKIPPED_NEXT,
  ANALYTICS_EVENTS.PLAYBACK_SKIPPED_PREV,
  ANALYTICS_EVENTS.PLAYBACK_PAUSED,
]);

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: true, stored: false });
  }

  const ip = getClientIp(request);
  if (await isRateLimited("analytics", ip, 120, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getSpotifySession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const eventType = body?.eventType as string | undefined;

  if (!eventType || !CLIENT_ALLOWED_EVENTS.has(eventType)) {
    return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
  }

  const appUser = await resolveAppUser();
  const sessionId = await resolveAnalyticsSessionId();

  trackEventAsync(appUser?.id ?? null, eventType as AnalyticsEventType, {
    sessionId,
    trackId: typeof body?.trackId === "string" ? body.trackId.slice(0, 64) : undefined,
    trackName: typeof body?.trackName === "string" ? body.trackName.slice(0, 512) : undefined,
    artistName: typeof body?.artistName === "string" ? body.artistName.slice(0, 512) : undefined,
    albumName: typeof body?.albumName === "string" ? body.albumName.slice(0, 512) : undefined,
    properties: body?.properties && typeof body.properties === "object" ? body.properties : undefined,
  });

  return NextResponse.json({ ok: true, stored: true });
}
