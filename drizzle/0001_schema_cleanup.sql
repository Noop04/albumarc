ALTER TABLE "app_users" DROP COLUMN IF EXISTS "display_name";
ALTER TABLE "app_users" DROP COLUMN IF EXISTS "image_url";

ALTER TABLE "user_playlists" DROP COLUMN IF EXISTS "playlist_name";
ALTER TABLE "user_playlists" DROP COLUMN IF EXISTS "spotify_url";

ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "track_name";
ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "artist_name";
ALTER TABLE "analytics_events" DROP COLUMN IF EXISTS "album_name";
