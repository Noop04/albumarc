import { isTokenRevocationStatus, SpotifyTokenRevokedError } from "./auth-errors";
import { getSpotifyConfig, SPOTIFY_TOKEN_URL } from "./config";
import type { SpotifyTokenResponse } from "./types";

function toBasicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getSpotifyConfig();

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${toBasicAuth(clientId, clientSecret)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify token exchange failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<SpotifyTokenResponse>;
}

export async function refreshAccessToken(refreshToken: string): Promise<SpotifyTokenResponse> {
  const { clientId, clientSecret } = getSpotifyConfig();

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${toBasicAuth(clientId, clientSecret)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (isTokenRevocationStatus(response.status)) {
      throw new SpotifyTokenRevokedError(
        response.status,
        `Spotify refresh token revoked: ${response.status} ${body}`
      );
    }
    throw new Error(`Spotify token refresh failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<SpotifyTokenResponse>;
}
