import { eq } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { appUsers } from "@/lib/db/schema";
import { decryptPayload, encryptPayload } from "@/lib/security/session-crypto";

type StoredRefreshToken = { refreshToken: string };

export async function persistUserRefreshToken(
  userId: string,
  refreshToken: string
): Promise<void> {
  const db = getDb();
  if (!db) return;

  await db
    .update(appUsers)
    .set({ encryptedRefreshToken: encryptPayload({ refreshToken }) })
    .where(eq(appUsers.id, userId));
}

export async function getUserRefreshToken(userId: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  const [user] = await db
    .select({ encryptedRefreshToken: appUsers.encryptedRefreshToken })
    .from(appUsers)
    .where(eq(appUsers.id, userId))
    .limit(1);

  if (!user?.encryptedRefreshToken) return null;

  const payload = decryptPayload<StoredRefreshToken>(user.encryptedRefreshToken);
  return payload?.refreshToken ?? null;
}
