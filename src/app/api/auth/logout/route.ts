import { after, NextResponse } from "next/server";

import { trackEventAsync } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";
import { clearSpotifySession } from "@/lib/spotify/session";
import { resolveAppUser } from "@/lib/users/resolve";

export async function POST() {
  const appUser = await resolveAppUser();

  await clearSpotifySession();

  after(() => {
    trackEventAsync(appUser?.id ?? null, ANALYTICS_EVENTS.AUTH_DISCONNECTED, {
      properties: { source: "logout" },
    });
  });

  return NextResponse.json({ ok: true });
}
