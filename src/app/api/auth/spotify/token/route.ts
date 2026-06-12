import { NextResponse } from "next/server";

import { getClientIp, isRateLimited } from "@/lib/security/rate-limit";
import { getSpotifyConfig } from "@/lib/spotify/config";
import { getUserAccessToken } from "@/lib/spotify/client";
import { getSpotifySession } from "@/lib/spotify/session";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (await isRateLimited("token", ip, 30, 60)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getSpotifySession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const accessToken = await getUserAccessToken();
    const { clientId } = getSpotifyConfig();

    return NextResponse.json(
      { accessToken, clientId },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch {
    return NextResponse.json({ error: "Failed to get token" }, { status: 500 });
  }
}
