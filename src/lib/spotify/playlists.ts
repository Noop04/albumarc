import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { userPlaylists } from "@/lib/db/schema";
import { Logger } from "@/utils/logger";

import { trackUrisHash } from "@/lib/sync/hash";

import { getUserAccessToken } from "./client";
import { SPOTIFY_API_URL } from "./config";
import { spotifyPlaylistUrl } from "./urls";

const logger = new Logger("SpotifyPlaylists");

export const ALBUMARC_PLAYLIST_NAME = "albumarc";
const PLAYLIST_DESCRIPTION =
  "Personalized song picks from Albumarc — refreshed when you get new recommendations.";

type SpotifyPlaylistResponse = {
  id: string;
  external_urls: { spotify: string };
  snapshot_id: string;
};

type SpotifyPlaylistItemsResponse = {
  items: Array<{ item: { uri: string } | null }>;
  next: string | null;
};

async function spotifyUserRequest(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const token = await getUserAccessToken();
  return fetch(`${SPOTIFY_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

async function readSpotifyError(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  return body ? `${response.status}: ${body}` : String(response.status);
}

function spotifyRequestError(action: string, detail: string): Error {
  logger.warn(`Playlist sync Spotify error: ${action}`, { detail });
  return new Error(`${action} (${detail})`);
}

async function findExistingPlaylist(token: string): Promise<SpotifyPlaylistResponse | null> {
  let path: string | null = `/me/playlists?limit=50`;

  while (path) {
    const response = await fetch(`${SPOTIFY_API_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw spotifyRequestError("Failed to list playlists", await readSpotifyError(response));
    }

    const data = (await response.json()) as {
      items: Array<{ id: string; name: string; external_urls: { spotify: string }; snapshot_id: string }>;
      next: string | null;
    };

    const match = data.items.find(
      (playlist) => playlist.name.toLowerCase() === ALBUMARC_PLAYLIST_NAME
    );

    if (match) {
      return {
        id: match.id,
        external_urls: match.external_urls,
        snapshot_id: match.snapshot_id,
      };
    }

    path = data.next ? data.next.replace(SPOTIFY_API_URL, "") : null;
  }

  return null;
}

async function createPlaylist(): Promise<SpotifyPlaylistResponse> {
  const response = await spotifyUserRequest("/me/playlists", {
    method: "POST",
    body: JSON.stringify({
      name: ALBUMARC_PLAYLIST_NAME,
      description: PLAYLIST_DESCRIPTION,
      public: false,
    }),
  });

  if (!response.ok) {
    throw spotifyRequestError("Failed to create playlist", await readSpotifyError(response));
  }

  return response.json() as Promise<SpotifyPlaylistResponse>;
}

async function replacePlaylistItems(playlistId: string, uris: string[]): Promise<void> {
  const response = await spotifyUserRequest(`/playlists/${playlistId}/items`, {
    method: "PUT",
    body: JSON.stringify({ uris }),
  });

  if (!response.ok) {
    throw spotifyRequestError("Failed to update playlist items", await readSpotifyError(response));
  }
}

async function clearPlaylistItems(playlistId: string): Promise<void> {
  let snapshotId: string | undefined;

  while (true) {
    const query = snapshotId ? `?snapshot_id=${encodeURIComponent(snapshotId)}` : "";
    const response = await spotifyUserRequest(`/playlists/${playlistId}/items${query}`);

    if (!response.ok) {
      throw spotifyRequestError("Failed to read playlist items", await readSpotifyError(response));
    }

    const data = (await response.json()) as SpotifyPlaylistItemsResponse;
    const uris = data.items
      .map((entry) => entry.item?.uri)
      .filter((uri): uri is string => Boolean(uri));

    if (uris.length === 0) return;

    const deleteResponse = await spotifyUserRequest(
      `/playlists/${playlistId}/items${query}`,
      {
        method: "DELETE",
        body: JSON.stringify({ items: uris.map((uri) => ({ uri })) }),
      }
    );

    if (!deleteResponse.ok) {
      throw spotifyRequestError("Failed to clear playlist", await readSpotifyError(deleteResponse));
    }

    const deleteResult = (await deleteResponse.json()) as { snapshot_id: string };
    snapshotId = deleteResult.snapshot_id;
  }
}

async function addItemsInBatches(playlistId: string, uris: string[]): Promise<void> {
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    const response = await spotifyUserRequest(`/playlists/${playlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });

    if (!response.ok) {
      throw spotifyRequestError("Failed to add playlist items", await readSpotifyError(response));
    }
  }
}

async function setPlaylistItems(playlistId: string, uris: string[]): Promise<void> {
  if (uris.length === 0) return;

  if (uris.length <= 100) {
    await replacePlaylistItems(playlistId, uris);
    return;
  }

  await clearPlaylistItems(playlistId);
  await addItemsInBatches(playlistId, uris);
}

export async function syncAlbumarcPlaylist(
  appUserId: string | null,
  trackUris: string[]
): Promise<{
  playlistId: string;
  spotifyUrl: string;
  trackCount: number;
  skipped: boolean;
}> {
  const uniqueUris = [...new Set(trackUris.filter((uri) => uri.startsWith("spotify:track:")))];
  if (uniqueUris.length === 0) {
    throw new Error("No valid track URIs to sync");
  }

  const syncHash = trackUrisHash(uniqueUris);
  const db = getDb();
  let cachedPlaylist: { spotifyPlaylistId: string; trackCount: number; lastSyncHash: string | null } | null =
    null;

  if (db && appUserId) {
    const [existing] = await db
      .select()
      .from(userPlaylists)
      .where(eq(userPlaylists.userId, appUserId))
      .limit(1);

    if (existing) {
      cachedPlaylist = existing;

      if (existing.lastSyncHash === syncHash) {
        return {
          playlistId: existing.spotifyPlaylistId,
          spotifyUrl: spotifyPlaylistUrl(existing.spotifyPlaylistId),
          trackCount: existing.trackCount,
          skipped: true,
        };
      }
    }
  }

  const token = await getUserAccessToken();

  const playlist = cachedPlaylist
    ? {
        id: cachedPlaylist.spotifyPlaylistId,
        external_urls: { spotify: spotifyPlaylistUrl(cachedPlaylist.spotifyPlaylistId) },
        snapshot_id: "",
      }
    : (await findExistingPlaylist(token)) ?? (await createPlaylist());

  await setPlaylistItems(playlist.id, uniqueUris);

  const spotifyUrl = spotifyPlaylistUrl(playlist.id);

  if (db && appUserId) {
    const [existing] = await db
      .select()
      .from(userPlaylists)
      .where(eq(userPlaylists.userId, appUserId))
      .limit(1);

    const now = new Date();
    const row = {
      spotifyPlaylistId: playlist.id,
      trackCount: uniqueUris.length,
      lastSyncHash: syncHash,
      lastSyncedAt: now,
      updatedAt: now,
    };

    if (existing) {
      await db.update(userPlaylists).set(row).where(eq(userPlaylists.id, existing.id));
    } else {
      await db.insert(userPlaylists).values({ userId: appUserId, ...row });
    }
  }

  logger.info("Synced albumarc playlist", {
    userId: appUserId,
    trackCount: uniqueUris.length,
    playlistId: playlist.id,
  });

  return {
    playlistId: playlist.id,
    spotifyUrl,
    trackCount: uniqueUris.length,
    skipped: false,
  };
}
