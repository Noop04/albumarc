import * as Sentry from "@sentry/nextjs";

import { Logger } from "@/utils/logger";

import { getAppAccessToken } from "./app-token";
import { refreshAccessToken } from "./auth";
import { SPOTIFY_API_URL } from "./config";
import { getSpotifySession, setSpotifySession } from "./session";
import type {
  SpotifyRecommendationsResponse,
  SpotifySavedTracksResponse,
  SpotifySearchTracksResponse,
  SpotifyTopArtistsResponse,
  SpotifyTopTracksResponse,
  SpotifyUserProfile,
} from "./types";

const logger = new Logger("SpotifyClient");

let tokenOverride: string | null = null;

export async function withUserToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
  tokenOverride = token;
  try {
    return await fn();
  } finally {
    tokenOverride = null;
  }
}

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "SpotifyApiError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshStoredAccessToken(reason: "expired" | "unauthorized"): Promise<string> {
  const session = await getSpotifySession();
  if (!session?.refreshToken) {
    throw new Error("Spotify session expired. Please reconnect.");
  }

  logger.info("Refreshing Spotify access token", { reason });
  const tokens = await refreshAccessToken(session.refreshToken);

  await setSpotifySession({
    ...session,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? session.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });

  return tokens.access_token;
}

async function getValidUserAccessToken(): Promise<string> {
  if (tokenOverride) return tokenOverride;

  const session = await getSpotifySession();
  if (!session) {
    throw new Error("Not authenticated with Spotify");
  }

  if (Date.now() < session.expiresAt - 60_000) {
    return session.accessToken;
  }

  return refreshStoredAccessToken("expired");
}

async function spotifyFetch<T = unknown>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const url = path.startsWith("http") ? path : `${SPOTIFY_API_URL}${path}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });

    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? "2");
      await sleep(Math.min(retryAfter * 1000, 12_000));
      continue;
    }

    if (response.status === 401) {
      throw new SpotifyApiError("Spotify unauthorized", 401);
    }

    if (!response.ok) {
      const body = await response.text();
      logger.warn("Spotify API request failed", { path, status: response.status, body });
      Sentry.captureMessage("Spotify API request failed", {
        level: "warning",
        extra: { path, status: response.status, body: body.slice(0, 500) },
      });
      throw new SpotifyApiError(`Spotify API error ${response.status}`, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  throw new SpotifyApiError("Spotify API rate limit exceeded", 429);
}

async function spotifyUserFetch<T = unknown>(
  path: string,
  init?: RequestInit,
  allowRetry = true
): Promise<T> {
  const token = await getValidUserAccessToken();

  try {
    return await spotifyFetch<T>(path, token, init);
  } catch (error) {
    if (allowRetry && error instanceof SpotifyApiError && error.status === 401) {
      const refreshed = await refreshStoredAccessToken("unauthorized");
      return spotifyFetch<T>(path, refreshed, init);
    }
    if (error instanceof SpotifyApiError && error.status === 401) {
      throw new Error("Spotify session expired. Please reconnect.");
    }
    throw error;
  }
}

async function spotifyAppFetch<T = unknown>(path: string): Promise<T> {
  const token = await getAppAccessToken();
  return spotifyFetch<T>(path, token);
}

function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    chunks.push(ids.slice(i, i + size));
  }
  return chunks;
}

async function checkSavedTracksChunk(ids: string[]): Promise<boolean[]> {
  const params = new URLSearchParams({ ids: ids.join(",") });

  try {
    return await spotifyUserFetch<boolean[]>(`/me/tracks/contains?${params.toString()}`);
  } catch (error) {
    if (error instanceof SpotifyApiError && (error.status === 404 || error.status === 400)) {
      return spotifyUserFetch<boolean[]>(`/me/library/contains?${params.toString()}`);
    }
    throw error;
  }
}

/** Real-time liked-song check — up to 50 IDs per Spotify request. */
export async function checkSavedTracks(trackIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(trackIds.filter(Boolean))];
  if (unique.length === 0) return new Set();

  const chunks = chunkIds(unique, 50);
  const flags: boolean[] = [];

  for (const chunk of chunks) {
    const result = await checkSavedTracksChunk(chunk);
    flags.push(...result);
    if (chunks.length > 1) {
      await sleep(80);
    }
  }

  const liked = new Set<string>();
  unique.forEach((id, index) => {
    if (flags[index]) liked.add(id);
  });
  return liked;
}

export async function getLikedTracksCount(): Promise<number> {
  const page = await spotifyUserFetch<SpotifySavedTracksResponse>("/me/tracks?limit=1");
  return page.total ?? 0;
}

export async function getUserAccessToken(): Promise<string> {
  return getValidUserAccessToken();
}

export async function getUserProfile(): Promise<SpotifyUserProfile> {
  return spotifyUserFetch<SpotifyUserProfile>("/me");
}

export async function getTopArtists(limit = 20): Promise<SpotifyTopArtistsResponse> {
  return spotifyUserFetch<SpotifyTopArtistsResponse>(
    `/me/top/artists?limit=${limit}&time_range=medium_term`
  );
}

export async function getTopTracks(limit = 50): Promise<SpotifyTopTracksResponse> {
  return spotifyUserFetch<SpotifyTopTracksResponse>(
    `/me/top/tracks?limit=${limit}&time_range=medium_term`
  );
}

export async function getSpotifyRecommendations(
  seedArtistIds: string[],
  limit = 20
): Promise<SpotifyRecommendationsResponse> {
  const seeds = seedArtistIds.slice(0, 3).join(",");
  const params = new URLSearchParams({
    limit: String(Math.min(limit, 20)),
    seed_artists: seeds,
  });

  return spotifyUserFetch<SpotifyRecommendationsResponse>(
    `/recommendations?${params.toString()}`
  );
}

export async function searchTracks(
  query: string,
  limit = 10,
  offset = 0
): Promise<SpotifySearchTracksResponse> {
  const params = new URLSearchParams({
    type: "track",
    q: query,
    limit: String(Math.min(limit, 10)),
    offset: String(offset),
  });

  return spotifyAppFetch<SpotifySearchTracksResponse>(`/search?${params.toString()}`);
}

export async function startUserPlayback(
  uris: string[],
  deviceId?: string
): Promise<void> {
  if (deviceId) {
    await spotifyUserFetch("/me/player", {
      method: "PUT",
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });
  }

  const playPath = deviceId
    ? `/me/player/play?device_id=${encodeURIComponent(deviceId)}`
    : "/me/player/play";

  try {
    await spotifyUserFetch(playPath, {
      method: "PUT",
      body: JSON.stringify({ uris }),
    });
  } catch (error) {
    if (error instanceof SpotifyApiError && error.status === 404) {
      throw new Error(
        "Spotify player not ready. Wait a few seconds after the page loads, then try again."
      );
    }
    throw error;
  }
}

export async function saveTrackToLibrary(trackUri: string): Promise<void> {
  try {
    await spotifyUserFetch("/me/library", {
      method: "PUT",
      body: JSON.stringify({ uris: [trackUri] }),
    });
  } catch {
    const trackId = trackUri.replace("spotify:track:", "");
    await spotifyUserFetch("/me/tracks", {
      method: "PUT",
      body: JSON.stringify({ ids: [trackId] }),
    });
  }
}
