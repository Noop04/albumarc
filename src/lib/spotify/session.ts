import { cookies } from "next/headers";

import { decryptPayload, encryptPayload } from "@/lib/security/session-crypto";

const SESSION_COOKIE = "spotify_session";
const STATE_COOKIE = "spotify_oauth_state";

export type SpotifySession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  spotifyUserId?: string;
  appUserId?: string;
  analyticsSessionId?: string;
  displayName?: string | null;
  imageUrl?: string;
};

export async function getSpotifySession(): Promise<SpotifySession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const legacy = tryParseLegacySession(raw);
  if (legacy) return legacy;

  return decryptPayload<SpotifySession>(raw);
}

function tryParseLegacySession(raw: string): SpotifySession | null {
  if (!raw.startsWith("{")) return null;
  try {
    return JSON.parse(raw) as SpotifySession;
  } catch {
    return null;
  }
}

export async function setSpotifySession(session: SpotifySession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encryptPayload(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSpotifySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function setOAuthState(state: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

export async function consumeOAuthState(state: string): Promise<boolean> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  return stored === state;
}

export function getServerAnalyticsSessionId(session: SpotifySession | null): string | undefined {
  return session?.analyticsSessionId;
}
