declare namespace Spotify {
  interface Player {
    connect(): Promise<boolean>;
    disconnect(): void;
    addListener(
      event: string,
      callback: (state: PlayerState | { message: string } | { device_id: string }) => void
    ): void;
    removeListener(event: string): void;
    getCurrentState(): Promise<PlayerState | null>;
    setVolume(volume: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    togglePlay(): Promise<void>;
    seek(positionMs: number): Promise<void>;
    previousTrack(): Promise<void>;
    nextTrack(): Promise<void>;
    play(options: { uris?: string[]; offset?: { uri: string } | { position: number } }): Promise<void>;
  }

  interface PlayerState {
    paused: boolean;
    position: number;
    duration: number;
    track_window: {
      current_track: {
        id: string;
        uri: string;
        name: string;
        duration_ms: number;
        artists: { name: string }[];
        album: { name: string; images: { url: string }[] };
      };
    };
  }

  interface PlayerConstructor {
    new (options: {
      name: string;
      getOAuthToken: (callback: (token: string) => void) => void;
      volume?: number;
    }): Player;
  }

  const Player: PlayerConstructor;
}

interface Window {
  Spotify?: typeof Spotify;
  onSpotifyWebPlaybackSDKReady?: () => void;
}
