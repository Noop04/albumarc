"use client";

import { PlayerProvider } from "@/contexts/player-context";

import { AlbumRecommendations } from "./album-recommendations";
import { MusicPlayer } from "./music-player";
import { PreviewBanner } from "./preview-banner";

export function AlbumRecommendationsShell() {
  return (
    <PlayerProvider>
      <div className="space-y-4 pb-28">
        <PreviewBanner />
        <AlbumRecommendations />
      </div>
      <MusicPlayer />
    </PlayerProvider>
  );
}
