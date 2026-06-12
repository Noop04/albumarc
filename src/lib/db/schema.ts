import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const appUsers = pgTable(
  "app_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    spotifyUserId: varchar("spotify_user_id", { length: 64 }).notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    spotifyDisconnectedAt: timestamp("spotify_disconnected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("app_users_spotify_user_id_idx").on(table.spotifyUserId)]
);

export const recommendationHistory = pgTable(
  "recommendation_history",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    trackId: varchar("track_id", { length: 64 }).notNull(),
    recommendedAt: timestamp("recommended_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("recommendation_history_user_recommended_idx").on(table.userId, table.recommendedAt),
    index("recommendation_history_user_track_idx").on(table.userId, table.trackId),
  ]
);

export const userPlaylists = pgTable(
  "user_playlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUsers.id, { onDelete: "cascade" }),
    spotifyPlaylistId: varchar("spotify_playlist_id", { length: 64 }).notNull(),
    trackCount: integer("track_count").notNull().default(0),
    lastSyncHash: varchar("last_sync_hash", { length: 64 }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_playlists_user_id_idx").on(table.userId),
    uniqueIndex("user_playlists_spotify_playlist_id_idx").on(table.spotifyPlaylistId),
  ]
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid("user_id").references(() => appUsers.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 64 }),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    trackId: varchar("track_id", { length: 64 }),
    properties: jsonb("properties").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("analytics_events_user_created_idx").on(table.userId, table.createdAt),
    index("analytics_events_type_created_idx").on(table.eventType, table.createdAt),
    index("analytics_events_created_at_idx").on(table.createdAt),
    index("analytics_events_session_idx").on(table.sessionId, table.createdAt),
  ]
);

export type AppUser = typeof appUsers.$inferSelect;
export type UserPlaylist = typeof userPlaylists.$inferSelect;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type RecommendationHistory = typeof recommendationHistory.$inferSelect;
