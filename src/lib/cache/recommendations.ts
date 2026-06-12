import type { TrackRecommendation } from "@/lib/recommendations";

import { sha256Hex } from "./hash";
import { getRedis } from "./redis";

const CACHE_TTL_SECONDS = 15 * 60;
const STALE_TTL_SECONDS = 7 * 24 * 60 * 60;

export type CachedRecommendations = {
  recommendations: TrackRecommendation[];
  topGenres: string[];
  topCategories?: string[];
  cacheVersion?: number;
  source: string;
  fetchedAt: string;
};

function userKey(userId: string): string {
  return `recommendations:${userId}`;
}

function staleUserKey(userId: string): string {
  return `recommendations:stale:${userId}`;
}

async function cookieKey(sessionCookie: string): Promise<string> {
  const hash = await sha256Hex(sessionCookie);
  return `recommendations:cookie:${hash}`;
}

async function staleCookieKey(sessionCookie: string): Promise<string> {
  const hash = await sha256Hex(sessionCookie);
  return `recommendations:stale:cookie:${hash}`;
}

export async function getCachedRecommendations(
  userId: string
): Promise<CachedRecommendations | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<CachedRecommendations>(userKey(userId));
}

export async function getCachedRecommendationsByCookie(
  sessionCookie: string
): Promise<CachedRecommendations | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<CachedRecommendations>(await cookieKey(sessionCookie));
}

export async function getStaleRecommendations(
  userId: string
): Promise<CachedRecommendations | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<CachedRecommendations>(staleUserKey(userId));
}

export async function getStaleRecommendationsByCookie(
  sessionCookie: string
): Promise<CachedRecommendations | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<CachedRecommendations>(await staleCookieKey(sessionCookie));
}

export async function getRecommendationsCacheTtl(userId: string): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;
  const ttl = await redis.ttl(userKey(userId));
  return ttl > 0 ? ttl : null;
}

export async function setCachedRecommendations(
  userId: string,
  data: CachedRecommendations,
  sessionCookie?: string
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  await redis.set(userKey(userId), data, { ex: CACHE_TTL_SECONDS });
  await redis.set(staleUserKey(userId), data, { ex: STALE_TTL_SECONDS });

  if (sessionCookie) {
    await redis.set(await cookieKey(sessionCookie), data, { ex: CACHE_TTL_SECONDS });
    await redis.set(await staleCookieKey(sessionCookie), data, { ex: STALE_TTL_SECONDS });
  }
}
