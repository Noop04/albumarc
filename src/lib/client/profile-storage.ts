import type { MusicProfile } from "@/lib/cache/profile";
import { aggregateTopCategories } from "@/lib/profile/categories";

const STORAGE_KEY = "albumarc:musicProfile";

function normalizeProfile(profile: MusicProfile): MusicProfile {
  if ((profile.topCategories ?? []).length > 0) return profile;
  const derived = aggregateTopCategories(profile.topArtists ?? []);
  return derived.length > 0 ? { ...profile, topCategories: derived } : profile;
}

export function loadStoredProfile(): MusicProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeProfile(JSON.parse(raw) as MusicProfile);
  } catch {
    return null;
  }
}

export function saveStoredProfile(profile: MusicProfile): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // ignore quota errors
  }
}

export function clearStoredProfile(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function fetchAndStoreProfile(): Promise<MusicProfile | null> {
  try {
    const response = await fetch("/api/profile");
    if (response.status === 401) return null;
    if (!response.ok) return null;

    const data = (await response.json()) as MusicProfile & { cached?: boolean };
    const { cached: _cached, ...profile } = data;
    const normalized = normalizeProfile(profile);
    saveStoredProfile(normalized);
    return normalized;
  } catch {
    return null;
  }
}
