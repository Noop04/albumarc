import type { FeedbackSignals } from "../feedback";
import {
  applyFeedbackToScore,
  computeMatchScore,
  isExcludedTrack,
  mergeScoredTrack,
  shouldHardExcludeArtist,
  softArtistPenalty,
} from "../scoring";

const emptyFeedback: FeedbackSignals = {
  skippedTrackIds: new Set(),
  likedTrackIds: new Set(),
  skippedArtists: new Map(),
  likedArtists: new Map(),
};

describe("exclusion set", () => {
  it("filters liked and history track IDs", () => {
    const excluded = new Set(["liked-1", "top-1", "history-1"]);
    expect(isExcludedTrack("liked-1", excluded)).toBe(true);
    expect(isExcludedTrack("new-track", excluded)).toBe(false);
  });
});

describe("artist filter", () => {
  const topArtistIds = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"];

  it("hard excludes top 5 artists", () => {
    expect(shouldHardExcludeArtist("a1", topArtistIds)).toBe(true);
    expect(shouldHardExcludeArtist("a5", topArtistIds)).toBe(true);
    expect(shouldHardExcludeArtist("a6", topArtistIds)).toBe(false);
  });

  it("applies soft penalty for artists ranked 6-15", () => {
    expect(softArtistPenalty("a6", topArtistIds)).toBe(20);
    expect(softArtistPenalty("a1", topArtistIds)).toBe(0);
    expect(softArtistPenalty("unknown", topArtistIds)).toBe(0);
  });
});

describe("applyFeedbackToScore", () => {
  it("clamps between 40 and 100", () => {
    const heavySkip: FeedbackSignals = {
      ...emptyFeedback,
      skippedTrackIds: new Set(["t1"]),
      skippedArtists: new Map([["Artist", 5]]),
    };
    expect(applyFeedbackToScore(45, "t1", "Artist", heavySkip)).toBeGreaterThanOrEqual(40);
    expect(applyFeedbackToScore(95, "t2", "Artist", emptyFeedback)).toBeLessThanOrEqual(100);
  });

  it("boosts liked tracks", () => {
    const liked: FeedbackSignals = {
      ...emptyFeedback,
      likedTrackIds: new Set(["t1"]),
    };
    const score = applyFeedbackToScore(70, "t1", "Artist", liked);
    expect(score).toBeGreaterThan(70);
  });
});

describe("deduplication", () => {
  it("keeps the highest score for duplicate track IDs", () => {
    const results = new Map<string, { matchScore: number }>();
    mergeScoredTrack(results, "track-1", { matchScore: 60 });
    mergeScoredTrack(results, "track-1", { matchScore: 75 });
    expect(results.get("track-1")?.matchScore).toBe(75);
  });
});

describe("computeMatchScore", () => {
  it("applies soft artist penalty in combined scoring", () => {
    const topArtistIds = ["a1", "a2", "a3", "a4", "a5", "a6"];
    const withPenalty = computeMatchScore(
      68,
      "Similar Artist",
      ["Main Artist"],
      "a6",
      topArtistIds,
      "track-1",
      emptyFeedback
    );
    const withoutPenalty = computeMatchScore(
      68,
      "Similar Artist",
      ["Main Artist"],
      "z9",
      topArtistIds,
      "track-2",
      emptyFeedback
    );
    expect(withPenalty).toBeLessThan(withoutPenalty);
  });
});
