"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, LogOut, Music2, Play, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePlayer } from "@/contexts/player-context";
import { isRecommendationsCacheValid } from "@/lib/recommendations/cache";
import type { TrackRecommendation } from "@/lib/recommendations";
import { formatCategoryLabel } from "@/lib/profile/categories";
import type { PlayerTrack } from "@/lib/spotify/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { clearStoredProfile, fetchAndStoreProfile } from "@/lib/client/profile-storage";
import {
  loadStoredRecommendations,
  saveStoredRecommendations,
  storedTrackUris,
} from "@/lib/client/recommendations-storage";
import { cn } from "@/lib/utils";

type RecommendResponse = {
  recommendations: TrackRecommendation[];
  topGenres: string[];
  topCategories?: string[];
  cacheVersion?: number;
  source: string;
  fetchedAt?: string;
  cached?: boolean;
  stale?: boolean;
};

type AuthUser = {
  id: string;
  name: string | null;
  imageUrl?: string;
};

function matchLabel(score: number): string {
  if (score >= 85) return "Strong match";
  if (score >= 70) return "Good match";
  if (score >= 55) return "Worth a listen";
  return "Might like";
}

function matchColor(score: number): string {
  if (score >= 85) return "text-emerald-400";
  if (score >= 70) return "text-amber-400";
  return "text-zinc-300";
}

function toPlayerTrack(rec: TrackRecommendation): PlayerTrack {
  return {
    id: rec.id,
    uri: rec.uri,
    name: rec.name,
    artist: rec.artist,
    album: rec.album,
    albumId: rec.albumId,
    imageUrl: rec.imageUrl,
    durationMs: rec.durationMs,
    previewUrl: rec.previewUrl,
  };
}

export function AlbumRecommendations() {
  const { playTracks, isLoading: playerLoading } = usePlayer();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [spotifyConfigured, setSpotifyConfigured] = useState<boolean | null>(null);
  const [redirectUri, setRedirectUri] = useState<string>("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [recommendations, setRecommendations] = useState<TrackRecommendation[]>([]);
  const [topGenres, setTopGenres] = useState<string[]>([]);
  const [topCategories, setTopCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState<string | null>(null);
  const [playlistSyncing, setPlaylistSyncing] = useState(false);
  const [playlistError, setPlaylistError] = useState<{ message: string; isScopeError?: boolean } | null>(null);

  const applyRecommendations = useCallback((data: RecommendResponse) => {
    setRecommendations(data.recommendations);
    setTopGenres(data.topGenres);
    setTopCategories(data.topCategories ?? []);
    setFetchedAt(data.fetchedAt ?? null);
    saveStoredRecommendations({
      recommendations: data.recommendations,
      topGenres: data.topGenres,
      topCategories: data.topCategories,
      cacheVersion: data.cacheVersion,
      fetchedAt: data.fetchedAt ?? null,
    });
  }, []);

  const syncPlaylist = useCallback(async (tracks: TrackRecommendation[]) => {
    if (tracks.length === 0) return;

    interface PlaylistSyncError extends Error {
      isScopeError?: boolean;
    }

    setPlaylistSyncing(true);
    setPlaylistError(null);

    try {
      const response = await fetch("/api/playlist/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trackUris: tracks.map((track) => track.uri),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorMsg = data.error ?? "Failed to sync playlist";
        const err = new Error(errorMsg) as PlaylistSyncError;
        if (response.status === 403) {
          err.isScopeError = true;
        }
        throw err;
      }

      if (data.playlistUrl) {
        setPlaylistUrl(data.playlistUrl);
      }
    } catch (err) {
      const isScopeError = err instanceof Error && (err as PlaylistSyncError).isScopeError === true;
      setPlaylistError({
        message: err instanceof Error ? err.message : "Playlist sync failed",
        isScopeError,
      });
    } finally {
      setPlaylistSyncing(false);
    }
  }, []);

  const fetchRecommendations = useCallback(
    async (options?: { refresh?: boolean; showLoading?: boolean }) => {
      const showLoading = options?.showLoading ?? true;
      if (showLoading) {
        setLoading(true);
        setError(null);
      }

      try {
        const url = options?.refresh ? "/api/recommend?refresh=1" : "/api/recommend";
        const response = await fetch(url);
        if (response.status === 401) {
          setAuthenticated(false);
          return null;
        }
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message = body.error ?? "Failed to load recommendations";
          if (response.status === 429) {
            const stored = loadStoredRecommendations();
            if (stored?.recommendations.length) {
              applyRecommendations({
                recommendations: stored.recommendations,
                topGenres: stored.topGenres,
                topCategories: stored.topCategories,
                cacheVersion: stored.cacheVersion,
                source: "local-cache",
                fetchedAt: stored.fetchedAt ?? undefined,
              });
              setError("Spotify rate limit — showing your last recommendations. Try again in a minute.");
              return null;
            }
          }
          throw new Error(message);
        }

        const data: RecommendResponse = await response.json();
        const previousUris = storedTrackUris(loadStoredRecommendations());
        applyRecommendations(data);

        const newUris = data.recommendations.map((t) => t.uri).sort().join(",");
        const prevUris = [...previousUris].sort().join(",");

        if (newUris !== prevUris) {
          void syncPlaylist(data.recommendations);
        }

        if (data.stale) {
          return data;
        }

        if (!isRecommendationsCacheValid(data)) {
          void fetchRecommendations({ refresh: true, showLoading: false });
        }

        void fetchAndStoreProfile();

        return data;
      } catch (err) {
        if (showLoading) {
          setError(err instanceof Error ? err.message : "Could not load recommendations.");
        }
        return null;
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [applyRecommendations, syncPlaylist]
  );

  const loadRecommendations = useCallback(async () => {
    const stored = loadStoredRecommendations();
    if (stored?.recommendations.length) {
      setRecommendations(stored.recommendations);
      setTopGenres(stored.topGenres);
      setTopCategories(stored.topCategories ?? []);
      setFetchedAt(stored.fetchedAt);
      setLoading(false);
      void syncPlaylist(stored.recommendations);
    }

    await fetchRecommendations({ showLoading: !stored?.recommendations.length });
  }, [fetchRecommendations, syncPlaylist]);

  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error");

      if (urlError === "spotify_not_configured") {
        setError("Spotify credentials are not configured. Add them to .env.local and restart the dev server.");
      } else if (urlError === "spotify_denied") {
        setError("Spotify login was cancelled.");
      } else if (urlError?.startsWith("spotify_")) {
        setError("Spotify login failed. Check your credentials and redirect URI.");
      }

      if (urlError) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      const [statusResponse, meResponse] = await Promise.all([
        fetch("/api/auth/spotify/status"),
        fetch("/api/auth/me"),
      ]);

      const status = await statusResponse.json();
      setSpotifyConfigured(status.configured);
      setRedirectUri(status.redirectUri ?? "");

      const me = await meResponse.json();

      if (!me.authenticated) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      setAuthenticated(true);
      setUser(me.user);
      await Promise.all([loadRecommendations(), fetchAndStoreProfile()]);
    }

    init();
  }, [loadRecommendations]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearStoredProfile();
    setAuthenticated(false);
    setUser(null);
    setRecommendations([]);
    setTopGenres([]);
  }

  function handlePlaySong(index: number) {
    const queue = recommendations.map(toPlayerTrack);
    playTracks(queue, index);
  }

  if (authenticated === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading your music profile...</span>
      </div>
    );
  }

  if (authenticated && loading && !error && recommendations.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Finding songs matched to your taste...</span>
      </div>
    );
  }

  if (!authenticated) {
    if (spotifyConfigured === false) {
      return (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="text-center">
            <CardTitle className="text-white">Spotify setup required</CardTitle>
            <CardDescription className="text-zinc-400">
              Create a <code className="text-zinc-300">.env.local</code> file in the project root
              with your Spotify app credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pb-8 text-sm text-zinc-400">
            <ol className="list-decimal space-y-2 pl-5 text-left">
              <li>
                Create an app at{" "}
                <a
                  href="https://developer.spotify.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#1DB954] hover:underline"
                >
                  developer.spotify.com/dashboard
                </a>
              </li>
              <li>
                Add this redirect URI in your Spotify app settings:
                <code className="mt-1 block rounded bg-white/10 px-2 py-1 text-xs text-zinc-300">
                  {redirectUri || "http://127.0.0.1:3000/api/auth/spotify/callback"}
                </code>
              </li>
              <li>
                Add to <code className="text-zinc-300">.env.local</code>:
                <pre className="mt-1 overflow-x-auto rounded bg-white/10 p-3 text-xs text-zinc-300">
{`NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret`}
                </pre>
              </li>
              <li>Restart the dev server: <code className="text-zinc-300">npm run dev</code></li>
            </ol>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive-foreground">
            {error}
          </div>
        )}
        <Card className="border-white/10 bg-white/[0.03]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#1DB954]/20">
              <Music2 className="h-7 w-7 text-[#1DB954]" />
            </div>
            <CardTitle className="text-white">Connect your Spotify</CardTitle>
            <CardDescription className="text-zinc-400">
              We&apos;ll analyze your top artists, suggest new songs you haven&apos;t heard, and let
              you play them in high quality with skip and save-to-liked controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button
              asChild
              className="bg-[#1DB954] text-black hover:bg-[#1ed760]"
            >
              <a href="/api/auth/spotify">Connect with Spotify</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && authenticated) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {user?.imageUrl && (
              <Image
                src={user.imageUrl}
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 rounded-full"
              />
            )}
            <p className="text-sm font-medium text-white">{user?.name ?? "Spotify user"}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/auth/spotify?reconnect=1">Reconnect</a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-400 hover:text-white"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive-foreground">
          {error}
        </div>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={loadRecommendations}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {user?.imageUrl && (
            <Image
              src={user.imageUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 rounded-full"
            />
          )}
          <div>
            <p className="text-sm font-medium text-white">{user?.name ?? "Spotify user"}</p>
            <p className="text-xs text-zinc-500">Personalized songs · excludes your liked tracks</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/profile" prefetch>
              Music profile
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/api/auth/spotify?reconnect=1">Reconnect</a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-zinc-400 hover:text-white"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </Button>
        </div>
      </div>

      {(playlistSyncing || playlistUrl || playlistError) && (
        <Card className={cn(
          "border backdrop-blur-md transition-all duration-300 overflow-hidden",
          playlistSyncing && "border-blue-500/20 bg-blue-500/5 shadow-sm shadow-blue-500/5",
          !playlistSyncing && playlistUrl && "border-emerald-500/20 bg-emerald-500/5 shadow-sm shadow-emerald-500/5",
          !playlistSyncing && playlistError && (playlistError.isScopeError ? "border-rose-500/25 bg-rose-500/5 shadow-sm shadow-rose-500/5" : "border-amber-500/20 bg-amber-500/5 shadow-sm shadow-amber-500/5")
        )}>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
              <div className="flex items-center gap-3 text-left">
                {playlistSyncing && (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-blue-400 shrink-0" />
                    <div>
                      <p className="font-medium text-white">Syncing playlist...</p>
                      <p className="text-xs text-zinc-400">Saving songs to your &quot;albumarc&quot; Spotify playlist</p>
                    </div>
                  </>
                )}
                {!playlistSyncing && playlistUrl && (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-medium text-white">Playlist synced</p>
                      <p className="text-xs text-zinc-400">{recommendations.length} songs are up-to-date in your library</p>
                    </div>
                  </>
                )}
                {!playlistSyncing && playlistError && (
                  <>
                    <AlertCircle className={cn("h-5 w-5 shrink-0", playlistError.isScopeError ? "text-rose-400" : "text-amber-400")} />
                    <div>
                      <p className="font-medium text-white">
                        {playlistError.isScopeError ? "Permissions required" : "Sync failed"}
                      </p>
                      <p className="text-xs text-zinc-400">{playlistError.message}</p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                {!playlistSyncing && playlistUrl && (
                  <Button
                    asChild
                    size="sm"
                    className="w-full sm:w-auto bg-[#1DB954] text-black hover:bg-[#1ed760] font-medium transition-all duration-200 shadow-md shadow-[#1DB954]/10 hover:shadow-[#1DB954]/20 rounded-full text-xs py-1.5 px-4 h-9"
                  >
                    <a
                      href={playlistUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 justify-center"
                    >
                      <span>Open Playlist</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
                {!playlistSyncing && playlistError && (
                  playlistError.isScopeError ? (
                    <Button
                      asChild
                      size="sm"
                      className="w-full sm:w-auto bg-white text-black hover:bg-zinc-200 font-medium rounded-full text-xs py-1.5 px-4 h-9 shadow-sm"
                    >
                      <a href="/api/auth/spotify?reconnect=1">
                        Reconnect Spotify
                      </a>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => syncPlaylist(recommendations)}
                      className="w-full sm:w-auto bg-zinc-800 text-white hover:bg-zinc-700 font-medium rounded-full text-xs py-1.5 px-4 h-9 border border-zinc-700/50 flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Retry Sync</span>
                    </Button>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {topCategories.length > 0 && (
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Categories you like</p>
          <div className="flex flex-wrap justify-center gap-2">
            {topCategories.map((category) => (
              <span
                key={category}
                className="rounded-full border border-[#1DB954]/25 bg-[#1DB954]/10 px-3 py-1 text-xs font-medium text-[#1ed760]"
              >
                {formatCategoryLabel(category)}
              </span>
            ))}
          </div>
        </div>
      )}

      {topGenres.length > 0 && (
        <div className="space-y-2 text-center">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Top artists</p>
          <div className="flex flex-wrap justify-center gap-2">
            {topGenres.map((artist) => (
              <span
                key={artist}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300"
              >
                {artist}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3">
        {recommendations.map((rec, index) => (
          <Card
            key={rec.id}
            className="border-white/10 bg-white/[0.03] transition-colors hover:bg-white/[0.05]"
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                {rec.imageUrl ? (
                  <Image
                    src={rec.imageUrl}
                    alt=""
                    width={48}
                    height={48}
                    className="h-12 w-12 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-white/10">
                    <Music2 className="h-5 w-5 text-zinc-300" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    #{index + 1} · {matchLabel(rec.matchScore)}
                  </p>
                  <CardTitle className="truncate text-base text-white">
                    <a
                      href={rec.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#1DB954] hover:underline"
                    >
                      {rec.name}
                    </a>
                  </CardTitle>
                  <CardDescription className="truncate text-zinc-400">
                    {rec.artist} · {rec.album}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className={cn("text-xl font-bold", matchColor(rec.matchScore))}>
                    {rec.matchScore}%
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pb-3">
              <p className="mb-2 text-xs text-zinc-500">{rec.reason}</p>
              <Button
                className="w-full bg-[#1DB954] text-black hover:bg-[#1ed760]"
                onClick={() => handlePlaySong(index)}
                disabled={playerLoading}
              >
                <Play className="mr-2 h-4 w-4" />
                Play song
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {fetchedAt && (
        <p className="text-center text-xs text-zinc-600">
          Updated {new Date(fetchedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
