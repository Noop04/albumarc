ALTER TABLE "app_users" ADD COLUMN IF NOT EXISTS "encrypted_refresh_token" text;

CREATE TABLE IF NOT EXISTS "recommendation_history" (
  "id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "user_id" uuid NOT NULL REFERENCES "app_users"("id") ON DELETE cascade,
  "track_id" varchar(64) NOT NULL,
  "recommended_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "recommendation_history_user_recommended_idx" ON "recommendation_history" ("user_id", "recommended_at");
CREATE INDEX IF NOT EXISTS "recommendation_history_user_track_idx" ON "recommendation_history" ("user_id", "track_id");
