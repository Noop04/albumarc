import { NextResponse } from "next/server";

import { DEFAULT_APP_URL, getSpotifyConfig, isSpotifyConfigured } from "@/lib/spotify/config";

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? `${appUrl}/api/auth/spotify/callback`;

  let clientId: string | null = null;
  if (isSpotifyConfigured()) {
    clientId = getSpotifyConfig().clientId;
  }

  return NextResponse.json({
    configured: isSpotifyConfigured(),
    redirectUri,
    clientId,
  });
}
