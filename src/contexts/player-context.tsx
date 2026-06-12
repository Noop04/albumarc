"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { trackClientEvent } from "@/lib/analytics/client";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";
import type { PlayerTrack } from "@/lib/spotify/types";

function trackPayload(track: PlayerTrack) {
  return {
    trackId: track.id,
    trackName: track.name,
    artistName: track.artist,
    albumName: track.album,
  };
}

type PlayerContextValue = {
  queue: PlayerTrack[];
  currentIndex: number;
  currentTrack: PlayerTrack | null;
  isPlaying: boolean;
  isLoading: boolean;
  isReady: boolean;
  positionMs: number;
  durationMs: number;
  likedTracks: Set<string>;
  playerError: string | null;
  isPreviewMode: boolean;
  isMobile: boolean;
  playTracks: (tracks: PlayerTrack[], startIndex?: number) => Promise<void>;
  togglePlay: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  likeCurrentTrack: () => Promise<void>;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

function loadSpotifySdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Spotify) return Promise.resolve();

  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve();

    const existing = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
    if (existing) {
      const deadline = Date.now() + 10_000;
      const poll = () => {
        if (window.Spotify) {
          resolve();
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error("Spotify SDK load timeout"));
          return;
        }
        setTimeout(poll, 50);
      };
      poll();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;
    script.onerror = () => reject(new Error("Failed to load Spotify SDK"));
    document.body.appendChild(script);
  });
}

function waitForDeviceReady(
  getDeviceId: () => string | null,
  timeoutMs = 15_000
): Promise<string | null> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      const deviceId = getDeviceId();
      if (deviceId) {
        resolve(deviceId);
        return;
      }
      if (Date.now() > deadline) {
        resolve(null);
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  });
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const playerRef = useRef<Spotify.Player | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<PlayerTrack[]>([]);
  const indexRef = useRef(0);
  const useSdkRef = useRef(true);
  const initPromiseRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const autoAdvancingRef = useRef(false);
  const playTrackAtIndexRef = useRef<(index: number) => Promise<void>>(async () => {});

  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [likedTracks, setLikedTracks] = useState<Set<string>>(new Set());
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const currentTrack = queue[currentIndex] ?? null;

  const syncRefs = useCallback((nextQueue: PlayerTrack[], nextIndex: number) => {
    queueRef.current = nextQueue;
    indexRef.current = nextIndex;
    setQueue(nextQueue);
    setCurrentIndex(nextIndex);
  }, []);

  const playViaSpotify = useCallback(async (track: PlayerTrack) => {
    const deviceId = deviceIdRef.current ?? (await waitForDeviceReady(() => deviceIdRef.current));

    if (!deviceId) {
      throw new Error("Spotify player is still starting. Wait a moment and try again.");
    }

    const response = await fetch("/api/player/play", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uris: [track.uri],
        deviceId: deviceId ?? undefined,
        ...trackPayload(track),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Spotify playback failed");
    }

    setIsPlaying(true);
    setIsPreviewMode(false);
    setPlayerError(null);
  }, []);

  const autoAdvanceToNext = useCallback(async () => {
    if (autoAdvancingRef.current) return;
    const nextIndex = indexRef.current + 1;
    if (nextIndex >= queueRef.current.length) return;

    autoAdvancingRef.current = true;
    setIsLoading(true);
    try {
      await playTrackAtIndexRef.current(nextIndex);
    } finally {
      autoAdvancingRef.current = false;
      setIsLoading(false);
    }
  }, []);

  const playPreview = useCallback(
    (track: PlayerTrack) => {
      if (!track.previewUrl) {
        setPlayerError(
          "Reconnect Spotify to enable full playback. Disconnect, then connect again."
        );
        return;
      }

      useSdkRef.current = false;
      setIsPreviewMode(true);
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }

      const previewDurationMs = Math.min(track.durationMs || 30_000, 30_000);
      setDurationMs(previewDurationMs);
      setPositionMs(0);

      const audio = new Audio(track.previewUrl);
      previewAudioRef.current = audio;

      audio.ontimeupdate = () => {
        setPositionMs(audio.currentTime * 1000);
        if (audio.duration && Number.isFinite(audio.duration)) {
          setDurationMs(Math.min(audio.duration * 1000, previewDurationMs));
        }
      };

      audio.onended = () => {
        setIsPlaying(false);
        setPositionMs(previewDurationMs);
        void autoAdvanceToNext();
      };

      audio.play().then(() => {
        setIsPlaying(true);
        setPlayerError("30s preview only — reconnect Spotify for full playback");
      });
    },
    [autoAdvanceToNext]
  );

  const playTrackAtIndex = useCallback(
    async (index: number) => {
      const tracks = queueRef.current;
      const track = tracks[index];
      if (!track) return;

      indexRef.current = index;
      setCurrentIndex(index);
      setPlayerError(null);
      setPositionMs(0);
      setDurationMs(track.durationMs || 0);

      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }

      if (useSdkRef.current) {
        try {
          await playViaSpotify(track);
          return;
        } catch {
          if (playerRef.current) {
            try {
              await playerRef.current.play({ uris: [track.uri] });
              setIsPlaying(true);
              return;
            } catch {
              // fall through to preview
            }
          }
        }
      }

      playPreview(track);
    },
    [playPreview, playViaSpotify]
  );

  useEffect(() => {
    playTrackAtIndexRef.current = playTrackAtIndex;
  }, [playTrackAtIndex]);

  useEffect(() => {
    const mobile =
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
    setIsMobile(mobile);
    if (mobile) {
      useSdkRef.current = false;
      setIsPreviewMode(true);
    }
  }, []);

  const initPlayer = useCallback(async () => {
    if (isMobile || playerRef.current) return;

    const tokenRes = await fetch("/api/auth/spotify/token");
    if (!tokenRes.ok) return;

    const { clientId } = await tokenRes.json();
    if (!clientId || !mountedRef.current) return;

    await loadSpotifySdk();
    if (!window.Spotify || !mountedRef.current) return;

    const player = new window.Spotify.Player({
      name: "Albumarc Player",
      volume: 1,
      getOAuthToken: async (callback) => {
        const res = await fetch("/api/auth/spotify/token");
        if (!res.ok) return;
        const data = await res.json();
        callback(data.accessToken);
      },
    });

    player.addListener("ready", (payload) => {
      if (!mountedRef.current) return;
      if ("device_id" in payload) {
        deviceIdRef.current = payload.device_id;
      }
      setIsReady(true);
      setIsPreviewMode(false);
      setPlayerError(null);
    });

    player.addListener("not_ready", () => {
      if (mountedRef.current) setIsReady(false);
    });

    player.addListener("player_state_changed", (state) => {
      if (!state || !("paused" in state) || !mountedRef.current) return;

      setIsPlaying(!state.paused);
      setPositionMs(state.position);
      setDurationMs(state.duration || 0);

      if (
        state.paused &&
        state.duration > 0 &&
        state.position >= state.duration - 750
      ) {
        void autoAdvanceToNext();
      }
    });

    player.addListener("initialization_error", (payload) => {
      if (mountedRef.current && "message" in payload) setPlayerError(payload.message);
    });

    player.addListener("authentication_error", () => {
      if (mountedRef.current) {
        setPlayerError("Spotify session expired. Disconnect and reconnect to play music.");
      }
    });

    player.addListener("account_error", () => {
      if (mountedRef.current) {
        useSdkRef.current = false;
        setIsPreviewMode(true);
        setPlayerError("Spotify Premium is required for full playback.");
      }
    });

    const connected = await player.connect();
    if (connected && mountedRef.current) {
      playerRef.current = player;
    }
  }, [autoAdvanceToNext, isMobile]);

  const ensurePlayerInitialized = useCallback(async () => {
    if (isMobile || playerRef.current) return;

    if (!initPromiseRef.current) {
      initPromiseRef.current = initPlayer().catch((error) => {
        initPromiseRef.current = null;
        if (mountedRef.current) {
          setPlayerError("Could not initialize Spotify player.");
        }
        throw error;
      });
    }

    await initPromiseRef.current;
  }, [initPlayer, isMobile]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      playerRef.current?.disconnect();
      playerRef.current = null;
      initPromiseRef.current = null;
      previewAudioRef.current?.pause();
    };
  }, []);

  const playTracks = useCallback(
    async (tracks: PlayerTrack[], startIndex = 0) => {
      if (tracks.length === 0) return;

      setIsLoading(true);
      setPlayerError(null);
      useSdkRef.current = true;
      setIsPreviewMode(false);

      try {
        if (!isMobile) {
          await ensurePlayerInitialized();
        }
        if (!deviceIdRef.current) {
          await waitForDeviceReady(() => deviceIdRef.current, 15_000);
        }
        syncRefs(tracks, startIndex);
        await playTrackAtIndex(startIndex);
      } catch (error) {
        setPlayerError(error instanceof Error ? error.message : "Playback failed");
      } finally {
        setIsLoading(false);
      }
    },
    [ensurePlayerInitialized, isMobile, playTrackAtIndex, syncRefs]
  );

  const togglePlay = useCallback(async () => {
    if (!currentTrack) return;

    if (useSdkRef.current && playerRef.current) {
      await playerRef.current.togglePlay();
      return;
    }

    const audio = previewAudioRef.current;
    if (!audio) return;

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [currentTrack]);

  const skipNext = useCallback(async () => {
    const current = queueRef.current[indexRef.current];
    const nextIndex = indexRef.current + 1;
    if (nextIndex >= queueRef.current.length) return;
    if (current) {
      trackClientEvent(ANALYTICS_EVENTS.PLAYBACK_SKIPPED_NEXT, trackPayload(current));
    }
    setIsLoading(true);
    try {
      await playTrackAtIndex(nextIndex);
    } finally {
      setIsLoading(false);
    }
  }, [playTrackAtIndex]);

  const skipPrevious = useCallback(async () => {
    const current = queueRef.current[indexRef.current];
    const prevIndex = indexRef.current - 1;
    if (prevIndex < 0) return;
    if (current) {
      trackClientEvent(ANALYTICS_EVENTS.PLAYBACK_SKIPPED_PREV, trackPayload(current));
    }
    setIsLoading(true);
    try {
      await playTrackAtIndex(prevIndex);
    } finally {
      setIsLoading(false);
    }
  }, [playTrackAtIndex]);

  const seekTo = useCallback(async (ms: number) => {
    const clamped = Math.max(0, Math.min(ms, durationMs || ms));

    if (useSdkRef.current && playerRef.current) {
      await playerRef.current.seek(clamped);
      setPositionMs(clamped);
      return;
    }

    const audio = previewAudioRef.current;
    if (audio) {
      audio.currentTime = clamped / 1000;
      setPositionMs(clamped);
    }
  }, [durationMs]);

  const likeCurrentTrack = useCallback(async () => {
    const track = queueRef.current[indexRef.current];
    if (!track) return;

    const response = await fetch("/api/library/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trackUri: track.uri, ...trackPayload(track) }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setPlayerError(data.error ?? "Failed to save to Liked Songs");
      return;
    }

    setLikedTracks((prev) => new Set(prev).add(track.id));
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        queue,
        currentIndex,
        currentTrack,
        isPlaying,
        isLoading,
        isReady,
        positionMs,
        durationMs,
        likedTracks,
        playerError,
        isPreviewMode,
        isMobile,
        playTracks,
        togglePlay,
        skipNext,
        skipPrevious,
        seekTo,
        likeCurrentTrack,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within PlayerProvider");
  }
  return context;
}
