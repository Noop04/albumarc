import { NextResponse } from "next/server";

import {
  DEFAULT_APP_URL,
  getSpotifyAuthUrl,
  isSpotifyConfigured,
} from "@/lib/spotify/config";
import { setOAuthState } from "@/lib/spotify/session";
import { Logger } from "@/utils/logger";

const logger = new Logger("API:SpotifyAuth");

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;

  if (!isSpotifyConfigured()) {
    logger.error("Spotify credentials not configured");
    return NextResponse.redirect(`${appUrl}?error=spotify_not_configured`);
  }

  try {
    const state = crypto.randomUUID();
    await setOAuthState(state);

    const showDialog = new URL(request.url).searchParams.get("reconnect") === "1";
    const authUrl = getSpotifyAuthUrl(state, { showDialog });
    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error("Spotify auth redirect failed", error);
    return NextResponse.redirect(`${appUrl}?error=spotify_auth_failed`);
  }
}
