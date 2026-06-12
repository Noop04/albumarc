export const RECOMMENDATION_COUNT = 25;
export const RECOMMENDATIONS_CACHE_VERSION = 3;

export function isRecommendationsCacheValid(data: {
  cacheVersion?: number;
  recommendations: unknown[];
}): boolean {
  return (
    (data.cacheVersion ?? 0) === RECOMMENDATIONS_CACHE_VERSION &&
    data.recommendations.length >= RECOMMENDATION_COUNT
  );
}
