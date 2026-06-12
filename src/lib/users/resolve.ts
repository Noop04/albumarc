import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { appUsers, type AppUser } from "@/lib/db/schema";
import { getUserProfile } from "@/lib/spotify/client";
import { getSpotifySession, setSpotifySession } from "@/lib/spotify/session";

import { persistUserRefreshToken } from "./tokens";

export async function resolveAppUser(): Promise<AppUser | null> {
  const session = await getSpotifySession();
  if (!session) return null;

  const db = getDb();
  if (!db) return null;

  const now = new Date();

  if (session.appUserId) {
    const [cached] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, session.appUserId))
      .limit(1);

    if (cached) {
      await db
        .update(appUsers)
        .set({ lastSeenAt: now, updatedAt: now })
        .where(eq(appUsers.id, cached.id));
      if (session.refreshToken) {
        await persistUserRefreshToken(cached.id, session.refreshToken);
      }
      return cached;
    }
  }

  if (session.spotifyUserId) {
    const [existing] = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.spotifyUserId, session.spotifyUserId))
      .limit(1);

    if (existing) {
      await setSpotifySession({ ...session, appUserId: existing.id });
      await db
        .update(appUsers)
        .set({ lastSeenAt: now, updatedAt: now })
        .where(eq(appUsers.id, existing.id));
      if (session.refreshToken) {
        await persistUserRefreshToken(existing.id, session.refreshToken);
      }
      return existing;
    }
  }

  const profile = await getUserProfile();

  const [existing] = await db
    .select()
    .from(appUsers)
    .where(eq(appUsers.spotifyUserId, profile.id))
    .limit(1);

  if (existing) {
    await setSpotifySession({
      ...session,
      spotifyUserId: profile.id,
      appUserId: existing.id,
      displayName: profile.display_name,
      imageUrl: profile.images[0]?.url,
    });
    await db
      .update(appUsers)
      .set({ lastSeenAt: now, updatedAt: now })
      .where(eq(appUsers.id, existing.id));
    if (session.refreshToken) {
      await persistUserRefreshToken(existing.id, session.refreshToken);
    }
    return existing;
  }

  const [created] = await db
    .insert(appUsers)
    .values({
      spotifyUserId: profile.id,
      lastSeenAt: now,
      updatedAt: now,
    })
    .returning();

  if (created) {
    await setSpotifySession({
      ...session,
      spotifyUserId: profile.id,
      appUserId: created.id,
      displayName: profile.display_name,
      imageUrl: profile.images[0]?.url,
    });
    if (session.refreshToken) {
      await persistUserRefreshToken(created.id, session.refreshToken);
    }
  }

  return created ?? null;
}
