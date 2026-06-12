import { isRecommendationsCacheValid } from "@/lib/recommendations/cache";
import type { TrackRecommendation } from "@/lib/recommendations";

const STORAGE_KEY = "albumarc:lastRecommendations";

export type StoredRecommendations = {
  recommendations: TrackRecommendation[];
  topGenres: string[];
  topCategories?: string[];
  cacheVersion?: number;
  fetchedAt: string | null;
};

export function isStoredRecommendationsStale(data: StoredRecommendations | null): boolean {
  if (!data) return true;
  return !isRecommendationsCacheValid(data);
}

export function loadStoredRecommendations(): StoredRecommendations | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredRecommendations;
    if (isStoredRecommendationsStale(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveStoredRecommendations(data: StoredRecommendations): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore quota errors
  }
}

export function storedTrackUris(data: StoredRecommendations | null): string[] {
  return data?.recommendations.map((t) => t.uri) ?? [];
}
