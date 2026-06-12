import { getSpotifyConfig, SPOTIFY_TOKEN_URL } from "./config";
import type { SpotifyTokenResponse } from "./types";

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function toBasicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
}

export async function getAppAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.accessToken;
  }

  const { clientId, clientSecret } = getSpotifyConfig();

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${toBasicAuth(clientId, clientSecret)}`,
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Spotify app token failed: ${response.status} ${body}`);
  }

  const tokens = (await response.json()) as SpotifyTokenResponse;
  cachedToken = {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };

  return cachedToken.accessToken;
}
