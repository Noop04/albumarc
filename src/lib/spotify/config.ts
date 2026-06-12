// Spotify requires loopback IP (127.0.0.1), not localhost, for HTTP redirect URIs
export const DEFAULT_APP_URL = "http://127.0.0.1:3000";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

export const SPOTIFY_SCOPES = [
  "user-top-read",
  "user-library-read",
  "user-library-modify",
  "user-read-email",
  "playlist-read-private",
  "playlist-modify-private",
  "playlist-modify-public",
  "streaming",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

export function getSpotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? `${appUrl}/api/auth/spotify/callback`;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET. Add them to .env.local — see .env.example."
    );
  }

  return { clientId, clientSecret, redirectUri, appUrl };
}

export function getSpotifyAuthUrl(
  state: string,
  options?: { showDialog?: boolean }
): string {
  const { clientId, redirectUri } = getSpotifyConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES,
    state,
  });

  if (options?.showDialog) {
    params.set("show_dialog", "true");
  }

  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

export { SPOTIFY_TOKEN_URL, SPOTIFY_API_URL };
