CREATE TABLE IF NOT EXISTS "app_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "spotify_user_id" varchar(64) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_users_spotify_user_id_idx" ON "app_users" ("spotify_user_id");

CREATE TABLE IF NOT EXISTS "user_playlists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "app_users"("id") ON DELETE cascade,
  "spotify_playlist_id" varchar(64) NOT NULL,
  "track_count" integer DEFAULT 0 NOT NULL,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_playlists_user_id_idx" ON "user_playlists" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "user_playlists_spotify_playlist_id_idx" ON "user_playlists" ("spotify_playlist_id");

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" uuid REFERENCES "app_users"("id") ON DELETE set null,
  "session_id" varchar(64),
  "event_type" varchar(64) NOT NULL,
  "track_id" varchar(64),
  "properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "analytics_events_user_created_idx" ON "analytics_events" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_type_created_idx" ON "analytics_events" ("event_type", "created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_created_at_idx" ON "analytics_events" ("created_at");
CREATE INDEX IF NOT EXISTS "analytics_events_session_idx" ON "analytics_events" ("session_id", "created_at");
