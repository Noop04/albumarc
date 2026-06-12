"use client";

import { Info } from "lucide-react";

import { usePlayer } from "@/contexts/player-context";

export function PreviewBanner() {
  const { isPreviewMode, isMobile, currentTrack } = usePlayer();

  if (!isPreviewMode && !isMobile) return null;

  const spotifyDeepLink = currentTrack
    ? `spotify://track/${currentTrack.id}`
    : "https://open.spotify.com";

  return (
    <div className="space-y-2">
      {isMobile && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100/90">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-medium">Mobile playback is preview-only.</strong> For full
              tracks, open on desktop or use the Spotify app.{" "}
              {currentTrack && (
                <a href={spotifyDeepLink} className="underline hover:text-sky-50">
                  Open in Spotify
                </a>
              )}
            </span>
          </p>
        </div>
      )}
      {isPreviewMode && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200/90">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-medium">30-second previews only.</strong> Spotify Premium is
              required for full-length playback. Tracks will cut off after 30 seconds.{" "}
              <a href="/api/auth/spotify?reconnect=1" className="underline hover:text-amber-100">
                Reconnect Spotify
              </a>{" "}
              if you have Premium and still see this.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
