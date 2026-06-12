-- Playlist sync hash for conditional sync
ALTER TABLE "user_playlists" ADD COLUMN IF NOT EXISTS "last_sync_hash" varchar(64);

-- Cron: skip users whose Spotify refresh token was revoked
ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "spotify_disconnected_at" timestamp with time zone;
