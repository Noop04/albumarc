import { after, NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { resolveAnalyticsSessionId } from "@/lib/analytics/session";
import { trackEventAsync } from "@/lib/analytics/track";
import { ANALYTICS_EVENTS } from "@/lib/analytics/types";
import {
  getCachedRecommendations,
  getRecommendationsCacheTtl,
  getStaleRecommendations,
  setCachedRecommendations,
} from "@/lib/cache/recommendations";
import { isRecommendationsCacheValid } from "@/lib/recommendations/cache";
import { getPersonalizedRecommendations } from "@/lib/recommendations";
import { SpotifyApiError } from "@/lib/spotify/client";
import { toPublicError } from "@/lib/security/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getSpotifySession } from "@/lib/spotify/session";
import { resolveAppUser } from "@/lib/users/resolve";
import { Logger } from "@/utils/logger";

const logger = new Logger("API:Recommend");

const SESSION_COOKIE = "spotify_session";

function getSessionCookie(request: NextRequest): string | null {
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

async function regenerateInBackground(
  appUserId: string | undefined,
  cacheUserId: string,
  sessionCookie: string | null
): Promise<void> {
  try {
    const data = await getPersonalizedRecommendations(appUserId);
    await setCachedRecommendations(cacheUserId, data, sessionCookie ?? undefined);
  } catch (error) {
    logger.warn("Background recommendation refresh failed", { error });
    Sentry.captureException(error);
  }
}

export async function handleRecommendGenerate(request: NextRequest): Promise<NextResponse> {
  const session = await getSpotifySession();
  if (!session) {
    return NextResponse.json({ error: "Connect Spotify to get recommendations" }, { status: 401 });
  }

  const appUser = await resolveAppUser();
  const rateKey = appUser?.id ?? session.spotifyUserId ?? session.appUserId ?? "unknown";

  const isDev = process.env.NODE_ENV === "development";
  const limit = isDev ? 100 : 3;
  const rate = await checkRateLimit("recommend", rateKey, limit, 5 * 60);
  if (rate.limited) {
    return NextResponse.json(
      { error: "Too many requests. Recommendations are cached for 15 minutes." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const sessionCookie = getSessionCookie(request);
  const cacheUserId = appUser?.id ?? session.spotifyUserId;
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";

  try {
    if (cacheUserId && !forceRefresh) {
      const cached = await getCachedRecommendations(cacheUserId);
      if (cached && isRecommendationsCacheValid(cached)) {
        const ttlRemaining = await getRecommendationsCacheTtl(cacheUserId);
        const analyticsSessionId = await resolveAnalyticsSessionId();

        after(() => {
          trackEventAsync(appUser?.id ?? null, ANALYTICS_EVENTS.RECOMMENDATIONS_CACHE_HIT, {
            sessionId: analyticsSessionId,
            properties: { ttlRemaining },
          });
        });

        return NextResponse.json({ ...cached, cached: true, stale: false });
      }

      const stale = await getStaleRecommendations(cacheUserId);
      if (stale && isRecommendationsCacheValid(stale)) {
        after(() => {
          void regenerateInBackground(appUser?.id, cacheUserId, sessionCookie);
        });

        return NextResponse.json({ ...stale, cached: false, stale: true });
      }
    }

    const data = await getPersonalizedRecommendations(appUser?.id);

    if (cacheUserId) {
      await setCachedRecommendations(cacheUserId, data, sessionCookie ?? undefined);
    }

    const analyticsSessionId = await resolveAnalyticsSessionId();

    after(() => {
      trackEventAsync(appUser?.id ?? null, ANALYTICS_EVENTS.RECOMMENDATIONS_GENERATED, {
        sessionId: analyticsSessionId,
        properties: {
          count: data.recommendations.length,
          trackIds: data.recommendations.map((track) => track.id),
        },
      });
    });

    return NextResponse.json({ ...data, cached: false, stale: false });
  } catch (error) {
    Sentry.captureException(error);
    logger.error("Failed to fetch recommendations", error);

    if (error instanceof SpotifyApiError && error.status === 429) {
      return NextResponse.json(
        {
          error:
            "Spotify rate limit hit. Wait a minute and try again — cached recommendations may still load.",
        },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const message = toPublicError(error, "Failed to fetch personalized recommendations");
    const status = message.includes("expired") || message.includes("authenticated")
      ? 401
      : message.includes("rate limit")
        ? 429
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
