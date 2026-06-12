"use client";

import { cn } from "@/lib/utils";

const BAR_COUNT = 28;

export function PlayerWaveform({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex h-10 items-end justify-center gap-[3px] px-1" aria-hidden>
      {Array.from({ length: BAR_COUNT }).map((_, index) => {
        const height = 28 + ((index * 13) % 72);
        return (
          <div
            key={index}
            className={cn(
              "w-[3px] origin-bottom rounded-full bg-[#1DB954]/80 transition-opacity",
              isPlaying ? "animate-player-bar" : "opacity-40"
            )}
            style={{
              height: `${height}%`,
              animationDelay: `${index * 45}ms`,
            }}
          />
        );
      })}
    </div>
  );
}
