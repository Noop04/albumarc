import type { FeedbackSignals } from "./feedback";

export const HARD_EXCLUDE_TOP_ARTIST_RANK = 5;
export const SOFT_PENALTY_TOP_ARTIST_RANK = 15;
export const SOFT_ARTIST_PENALTY = 20;

export function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

export function nameAffinity(candidate: string, references: string[]): number {
  const candidateTokens = tokenize(candidate);
  if (candidateTokens.length === 0) return 0;

  let best = 0;
  for (const reference of references) {
    const referenceTokens = tokenize(reference);
    if (referenceTokens.length === 0) continue;

    const shared = candidateTokens.filter((token) =>
      referenceTokens.some((ref) => ref.includes(token) || token.includes(ref))
    );

    best = Math.max(
      best,
      shared.length / Math.max(candidateTokens.length, referenceTokens.length)
    );
  }

  return best;
}

export function getArtistRank(
  artistId: string,
  topArtistIds: string[]
): number | null {
  const index = topArtistIds.indexOf(artistId);
  return index === -1 ? null : index + 1;
}

export function shouldHardExcludeArtist(
  artistId: string,
  topArtistIds: string[]
): boolean {
  const rank = getArtistRank(artistId, topArtistIds);
  return rank !== null && rank <= HARD_EXCLUDE_TOP_ARTIST_RANK;
}

export function softArtistPenalty(
  artistId: string,
  topArtistIds: string[]
): number {
  const rank = getArtistRank(artistId, topArtistIds);
  if (rank === null || rank <= HARD_EXCLUDE_TOP_ARTIST_RANK) return 0;
  if (rank <= SOFT_PENALTY_TOP_ARTIST_RANK) return SOFT_ARTIST_PENALTY;
  return 0;
}

export function computeMatchScore(
  baseScore: number,
  artistName: string,
  tasteNames: string[],
  artistId: string,
  topArtistIds: string[],
  trackId: string,
  feedback: FeedbackSignals
): number {
  const affinity = nameAffinity(artistName, tasteNames);
  let score = Math.round(Math.min(100, Math.max(50, baseScore + affinity * 30)));
  score -= softArtistPenalty(artistId, topArtistIds);
  return applyFeedbackToScore(score, trackId, artistName, feedback);
}

export function applyFeedbackToScore(
  baseScore: number,
  trackId: string,
  artistName: string,
  signals: FeedbackSignals
): number {
  let score = baseScore;

  if (signals.skippedTrackIds.has(trackId)) score -= 25;
  if (signals.likedTrackIds.has(trackId)) score += 10;

  const skipCount = signals.skippedArtists.get(artistName) ?? 0;
  const likeCount = signals.likedArtists.get(artistName) ?? 0;

  score -= Math.min(skipCount * 8, 24);
  score += Math.min(likeCount * 5, 15);

  return Math.round(Math.min(100, Math.max(40, score)));
}

export function mergeScoredTrack<T extends { matchScore: number }>(
  results: Map<string, T>,
  trackId: string,
  candidate: T
): void {
  const existing = results.get(trackId);
  if (!existing || existing.matchScore < candidate.matchScore) {
    results.set(trackId, candidate);
  }
}

export function isExcludedTrack(
  trackId: string,
  excludedTrackIds: Set<string>
): boolean {
  return excludedTrackIds.has(trackId);
}
