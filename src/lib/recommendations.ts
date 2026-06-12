import { aggregateTopCategories } from "@/lib/profile/categories";
import { Logger } from "@/utils/logger";

import { getFeedbackSignals, type FeedbackSignals } from "./recommendations/feedback";
import {
  getPreviouslyRecommendedTrackIds,
  saveRecommendationHistory,
} from "./recommendations/history";
import {
  computeMatchScore,
  mergeScoredTrack,
  nameAffinity,
  shouldHardExcludeArtist,
} from "./recommendations/scoring";
import {
  checkSavedTracks,
  getSpotifyRecommendations,
  getTopArtists,
  getTopTracks,
  searchTracks,
  withUserToken,
} from "./spotify/client";
import { refreshAccessToken } from "./spotify/auth";
import type { SpotifyArtist, SpotifyTrack } from "./spotify/types";

const logger = new Logger("Recommendations");

import {
  RECOMMENDATION_COUNT,
  RECOMMENDATIONS_CACHE_VERSION,
} from "./recommendations/cache";

export { RECOMMENDATION_COUNT, RECOMMENDATIONS_CACHE_VERSION, isRecommendationsCacheValid } from "./recommendations/cache";

export type TrackRecommendation = {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumId: string;
  uri: string;
  previewUrl: string | null;
  imageUrl?: string;
  durationMs: number;
  matchScore: number;
  matchingGenres: string[];
  url: string;
  reason: string;
};

type ScoredTrack = {
  track: SpotifyTrack;
  matchScore: number;
  matchingGenres: string[];
  reason: string;
};

type DiscoverOptions = {
  topArtists: SpotifyArtist[];
  excludedTrackIds: Set<string>;
  topArtistIds: string[];
  feedback: FeedbackSignals;
};

function buildTasteLabels(topArtists: SpotifyArtist[]): string[] {
  return topArtists.slice(0, 6).map((artist) => artist.name);
}

function toRecommendation(scored: ScoredTrack): TrackRecommendation {
  const { track, matchScore, matchingGenres, reason } = scored;
  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    albumId: track.album.id,
    uri: track.uri,
    previewUrl: track.preview_url,
    imageUrl: track.album.images?.[0]?.url,
    durationMs: track.duration_ms,
    matchScore,
    matchingGenres,
    url: `https://open.spotify.com/track/${track.id}`,
    reason,
  };
}

async function discoverTracks(options: DiscoverOptions): Promise<Map<string, ScoredTrack>> {
  const { topArtists, excludedTrackIds, topArtistIds, feedback } = options;
  const results = new Map<string, ScoredTrack>();
  const tasteNames = topArtists.map((artist) => artist.name);

  function addTracks(tracks: SpotifyTrack[], sourceLabel: string, baseScore: number) {
    for (const track of tracks) {
      if (excludedTrackIds.has(track.id)) continue;

      const primaryArtist = track.artists[0];
      if (!primaryArtist) continue;

      const isArtistSearch = sourceLabel.startsWith("near ");
      if (!isArtistSearch && shouldHardExcludeArtist(primaryArtist.id, topArtistIds)) continue;

      const matchScore = computeMatchScore(
        baseScore,
        primaryArtist.name,
        tasteNames,
        primaryArtist.id,
        topArtistIds,
        track.id,
        feedback
      );

      let reason =
        nameAffinity(primaryArtist.name, tasteNames) > 0.2
          ? `Similar vibe to ${tasteNames[0]}`
          : `Fresh pick in ${sourceLabel}`;

      if (feedback.skippedTrackIds.has(track.id)) {
        reason = "Lower priority — you skipped this before";
      } else if (feedback.likedTrackIds.has(track.id)) {
        reason = "You liked similar picks";
      }

      mergeScoredTrack(results, track.id, {
        track,
        matchScore,
        matchingGenres: [sourceLabel],
        reason,
      });
    }
  }

  const genreSet = new Set<string>();
  for (const artist of topArtists) {
    if (artist.genres) {
      for (const g of artist.genres) {
        genreSet.add(g);
      }
    }
  }
  const topGenresList = Array.from(genreSet).slice(0, 6);

  const searchJobs: Array<Promise<void>> = [
    searchTracks("year:2025", 15).then((r) => addTracks(r.tracks.items, "2025", 58)),
    searchTracks("year:2024", 15).then((r) => addTracks(r.tracks.items, "2024", 56)),
    searchTracks("tag:new", 15).then((r) => addTracks(r.tracks.items, "new releases", 62)),
    ...topGenresList.map((genre) =>
      searchTracks(`genre:"${genre}"`, 12).then((r) =>
        addTracks(r.tracks.items, genre, 60)
      )
    ),
    ...topArtists.slice(0, 5).map((artist) =>
      searchTracks(`artist:"${artist.name}" year:2024`, 12).then((r) =>
        addTracks(r.tracks.items, `near ${artist.name}`, 68)
      )
    ),
  ];

  const seedArtistIds = topArtists.slice(0, 3).map((a) => a.id);
  if (seedArtistIds.length > 0) {
    searchJobs.push(
      getSpotifyRecommendations(seedArtistIds, 20)
        .then((r) => addTracks(r.tracks, "Spotify picks", 72))
        .catch((error) => {
          logger.warn("Spotify recommendations endpoint unavailable", { error });
        })
    );
  }

  const batchSize = 4;
  for (let i = 0; i < searchJobs.length; i += batchSize) {
    const batch = searchJobs.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (job) => {
        try {
          await job;
        } catch (error) {
          logger.warn("Track search failed", { error });
        }
      })
    );
    if (i + batchSize < searchJobs.length) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  return results;
}

async function buildRecommendations(appUserId?: string) {
  const [topArtistsResult, topTracksResult, feedback, historyIds] = await Promise.all([
    getTopArtists(15),
    getTopTracks(50),
    appUserId ? getFeedbackSignals(appUserId) : Promise.resolve({
      skippedTrackIds: new Set<string>(),
      likedTrackIds: new Set<string>(),
      skippedArtists: new Map(),
      likedArtists: new Map(),
    }),
    appUserId ? getPreviouslyRecommendedTrackIds(appUserId) : Promise.resolve(new Set<string>()),
  ]);

  const topArtists = topArtistsResult.items;
  if (topArtists.length === 0) {
    throw new Error(
      "Spotify has no listening history for this account yet. Listen to more music and try again."
    );
  }

  const topArtistIds = topArtists.map((artist) => artist.id);
  const tasteLabels = buildTasteLabels(topArtists);

  const discoveryExclusions = new Set([
    ...historyIds,
    ...topTracksResult.items.map((track) => track.id),
  ]);

  const discovered = await discoverTracks({
    topArtists,
    excludedTrackIds: discoveryExclusions,
    topArtistIds,
    feedback,
  });

  const candidateIds = [...discovered.keys()];
  const likedIds = await checkSavedTracks(candidateIds);

  const recommendations = [...discovered.values()]
    .filter((scored) => !likedIds.has(scored.track.id))
    .map(toRecommendation)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, RECOMMENDATION_COUNT);

  if (recommendations.length === 0) {
    throw new Error(
      "No new songs found outside your library. Try listening to more varied music on Spotify."
    );
  }

  if (appUserId) {
    await saveRecommendationHistory(
      appUserId,
      recommendations.map((track) => track.id)
    );
  }

  logger.info("Generated personalized track recommendations", {
    count: recommendations.length,
    tasteLabels,
    candidatesChecked: candidateIds.length,
    likedExcluded: likedIds.size,
    historyExcluded: historyIds.size,
    feedbackSkips: feedback.skippedTrackIds.size,
  });

  return {
    recommendations,
    topGenres: tasteLabels,
    topCategories: aggregateTopCategories(
      topArtists.map((artist) => ({ genres: artist.genres ?? [] }))
    ),
    cacheVersion: RECOMMENDATIONS_CACHE_VERSION,
    source: "spotify-personalized-tracks",
    fetchedAt: new Date().toISOString(),
  };
}

export async function getPersonalizedRecommendations(appUserId?: string) {
  return buildRecommendations(appUserId);
}

export async function getPersonalizedRecommendationsForToken(
  appUserId: string,
  refreshToken: string
) {
  const tokens = await refreshAccessToken(refreshToken);
  return withUserToken(tokens.access_token, () => buildRecommendations(appUserId));
}

export { applyFeedbackToScore } from "./recommendations/scoring";
