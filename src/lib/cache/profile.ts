import { getRedis } from "./redis";

const CACHE_TTL_SECONDS = 30 * 60;

export type MusicProfile = {
  displayName: string | null;
  imageUrl?: string;
  topCategories: string[];
  topArtists: Array<{ id: string; name: string; imageUrl?: string; genres: string[] }>;
  topTracks: Array<{
    id: string;
    name: string;
    artist: string;
    album: string;
    imageUrl?: string;
  }>;
  stats: {
    likedTracksSampled: number;
    previouslyRecommended: number;
    skipsLast30Days: number;
    likesLast30Days: number;
  };
  fetchedAt: string;
};

function cacheKey(userId: string): string {
  return `profile:${userId}`;
}

export async function getCachedProfile(userId: string): Promise<MusicProfile | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get<MusicProfile>(cacheKey(userId));
}

export async function setCachedProfile(userId: string, profile: MusicProfile): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(cacheKey(userId), profile, { ex: CACHE_TTL_SECONDS });
}
