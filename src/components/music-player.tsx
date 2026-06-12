"use client";

import Image from "next/image";
import {
  Heart,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";

import { PlayerWaveform } from "@/components/player-waveform";
import { Button } from "@/components/ui/button";
import { usePlayer } from "@/contexts/player-context";
import { cn } from "@/lib/utils";

function formatTime(ms: number): string {
  if (!ms || ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export function MusicPlayer() {
  const {
    currentTrack,
    currentIndex,
    queue,
    isPlaying,
    isLoading,
    isReady,
    positionMs,
    durationMs,
    likedTracks,
    playerError,
    isPreviewMode,
    togglePlay,
    skipNext,
    skipPrevious,
    seekTo,
    likeCurrentTrack,
  } = usePlayer();

  if (!currentTrack && !isLoading && !playerError) return null;

  const isLiked = currentTrack ? likedTracks.has(currentTrack.id) : false;
  const canSkipBack = currentIndex > 0;
  const canSkipNext = currentIndex < queue.length - 1;
  const progress = durationMs > 0 ? Math.min((positionMs / durationMs) * 100, 100) : 0;

  function handleSeek(event: React.MouseEvent<HTMLDivElement>) {
    if (!durationMs) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    void seekTo(ratio * durationMs);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-zinc-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3">
        {playerError && (
          <p className="text-center text-xs text-amber-400/90">{playerError}</p>
        )}

        <PlayerWaveform isPlaying={isPlaying && !isLoading} />

        {currentTrack && durationMs > 0 && (
          <div className="space-y-1">
            <div
              className="group relative h-2 cursor-pointer rounded-full bg-white/10"
              onClick={handleSeek}
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={durationMs}
              aria-valuenow={positionMs}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-[#1DB954] transition-all"
                style={{ width: `${progress}%` }}
              />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
            <div className="flex justify-between text-[10px] tabular-nums text-zinc-500">
              <span>{formatTime(positionMs)}</span>
              <span>{formatTime(durationMs)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {currentTrack?.imageUrl ? (
            <Image
              src={currentTrack.imageUrl}
              alt=""
              width={48}
              height={48}
              className="h-12 w-12 rounded-md object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-md bg-white/10" />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">
              {currentTrack?.name ?? "Loading..."}
            </p>
            <p className="truncate text-xs text-zinc-400">
              {currentTrack?.artist ?? ""}
              {currentTrack ? ` · ${currentTrack.album}` : ""}
            </p>
            {isReady && !isPreviewMode && (
              <p className="flex items-center gap-1 text-[10px] text-[#1DB954]">
                <Volume2 className="h-3 w-3" />
                High quality · Spotify
              </p>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-zinc-400 hover:text-white disabled:opacity-30"
              onClick={skipPrevious}
              disabled={!canSkipBack || isLoading}
              aria-label="Previous track"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              className="h-10 w-10 bg-[#1DB954] text-black hover:bg-[#1ed760]"
              onClick={togglePlay}
              disabled={!currentTrack || isLoading}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-zinc-400 hover:text-white disabled:opacity-30"
              onClick={skipNext}
              disabled={!canSkipNext || isLoading}
              aria-label="Next track"
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9",
                isLiked ? "text-[#1DB954]" : "text-zinc-400 hover:text-[#1DB954]"
              )}
              onClick={likeCurrentTrack}
              disabled={!currentTrack || isLoading}
              aria-label="Save to Liked Songs"
            >
              <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
            </Button>
          </div>
        </div>

        {queue.length > 1 && currentTrack && (
          <p className="text-center text-[10px] text-zinc-500">
            Track {currentIndex + 1} of {queue.length}
            {isPreviewMode ? " · 30s previews" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
