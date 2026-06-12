import { after, NextRequest, NextResponse } from "next/server";

import { trackEventAsync } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";
import { exchangeCodeForTokens } from "@/lib/spotify/auth";
import { getUserProfile } from "@/lib/spotify/client";
import { getSpotifyConfig } from "@/lib/spotify/config";
import { consumeOAuthState, getSpotifySession, setSpotifySession } from "@/lib/spotify/session";
import { resolveAppUser } from "@/lib/users/resolve";
import { Logger } from "@/utils/logger";

const logger = new Logger("API:SpotifyCallback");

export async function GET(request: NextRequest) {
  const { appUrl } = getSpotifyConfig();
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    logger.error("Spotify OAuth denied", { error });
    return NextResponse.redirect(`${appUrl}?error=spotify_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}?error=spotify_missing_code`);
  }

  const validState = await consumeOAuthState(state);
  if (!validState) {
    return NextResponse.redirect(`${appUrl}?error=spotify_invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    await setSpotifySession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token!,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      analyticsSessionId: crypto.randomUUID(),
    });

    const profile = await getUserProfile();
    const existing = await getSpotifySession();

    await setSpotifySession({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token!,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      spotifyUserId: profile.id,
      analyticsSessionId: existing?.analyticsSessionId ?? crypto.randomUUID(),
      displayName: profile.display_name,
      imageUrl: profile.images[0]?.url,
    });

    after(async () => {
      const appUser = await resolveAppUser();
      const session = await getSpotifySession();
      if (appUser) {
        trackEventAsync(appUser.id, ANALYTICS_EVENTS.AUTH_CONNECTED, {
          sessionId: session?.analyticsSessionId,
        });
      }
    });

    return NextResponse.redirect(`${appUrl}?connected=spotify`);
  } catch (err) {
    logger.error("Spotify OAuth callback failed", err);
    return NextResponse.redirect(`${appUrl}?error=spotify_auth_failed`);
  }
}
