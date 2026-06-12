export const ANALYTICS_EVENTS = {
  AUTH_CONNECTED: "auth.connected",
  AUTH_DISCONNECTED: "auth.disconnected",
  AUTH_TOKEN_REVOKED: "auth.token_revoked",
  RECOMMENDATIONS_GENERATED: "recommendations.generated",
  RECOMMENDATIONS_CACHE_HIT: "recommendations.cache_hit",
  PLAYBACK_STARTED: "playback.started",
  PLAYBACK_PAUSED: "playback.paused",
  PLAYBACK_SKIPPED_NEXT: "playback.skipped_next",
  PLAYBACK_SKIPPED_PREV: "playback.skipped_prev",
  TRACK_LIKED: "track.liked",
  PLAYLIST_SYNCED: "playlist.synced",
} as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

export type TrackContext = {
  trackId?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
};

export type AnalyticsPayload = {
  sessionId?: string;
  trackId?: string;
  properties?: Record<string, unknown>;
};

export function buildEventProperties(
  payload: AnalyticsPayload & TrackContext
): Record<string, unknown> {
  const { trackName, artistName, albumName, properties } = payload;
  const merged: Record<string, unknown> = { ...(properties ?? {}) };

  if (trackName) merged.trackName = trackName;
  if (artistName) merged.artistName = artistName;
  if (albumName) merged.albumName = albumName;

  return merged;
}
