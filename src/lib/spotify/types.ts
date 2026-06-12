export type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  genres?: string[];
  external_urls?: { spotify: string };
  images?: { url: string }[];
};

export type SpotifyAlbum = {
  id: string;
  name: string;
  album_type: string;
  release_date: string;
  total_tracks: number;
  artists: { id: string; name: string }[];
  images: { url: string }[];
  external_urls: { spotify: string };
};

export type SpotifyTrack = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
  album: { id: string; name: string; images?: { url: string }[] };
  artists: { id: string; name: string }[];
};

export type SpotifySearchTracksResponse = {
  tracks: {
    items: SpotifyTrack[];
    total: number;
    limit: number;
    offset: number;
  };
};

export type PlayerTrack = {
  id: string;
  uri: string;
  name: string;
  artist: string;
  album: string;
  albumId: string;
  imageUrl?: string;
  durationMs: number;
  previewUrl: string | null;
};

export type SpotifySavedTrack = {
  track: { id: string; album: { id: string } } | null;
};

export type SpotifySavedAlbum = {
  album: SpotifyAlbum;
};

export type SpotifyTopArtistsResponse = {
  items: SpotifyArtist[];
};

export type SpotifyTopTracksResponse = {
  items: SpotifyTrack[];
};

export type SpotifyRecommendationsResponse = {
  tracks: SpotifyTrack[];
};

export type SpotifySearchAlbumsResponse = {
  albums: {
    items: SpotifyAlbum[];
    total: number;
    limit: number;
    offset: number;
  };
};

export type SpotifySavedTracksResponse = {
  items: SpotifySavedTrack[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
};

export type SpotifySavedAlbumsResponse = {
  items: SpotifySavedAlbum[];
  next: string | null;
};

export type SpotifyUserProfile = {
  id: string;
  display_name: string | null;
  email?: string;
  images: { url: string }[];
};
