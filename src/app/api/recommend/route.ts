import { NextRequest, NextResponse } from "next/server";

import { getCachedRecommendationsByCookie } from "@/lib/cache/recommendations";
import { isRecommendationsCacheValid } from "@/lib/recommendations/cache";

export const runtime = "edge";

const SESSION_COOKIE = "spotify_session";

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)?.value;

  if (sessionCookie) {
    const cached = await getCachedRecommendationsByCookie(sessionCookie);
    if (cached && isRecommendationsCacheValid(cached)) {
      return NextResponse.json(
        { ...cached, cached: true, stale: false, edge: true },
        { headers: { "Cache-Control": "private, no-store" } }
      );
    }
  }

  const generateUrl = new URL("/api/recommend/generate", request.url);
  generateUrl.search = request.nextUrl.search;

  const response = await fetch(generateUrl.toString(), {
    headers: {
      cookie: request.headers.get("cookie") ?? "",
    },
  });

  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "Content-Type": "application/json",
      ...(response.headers.get("Retry-After")
        ? { "Retry-After": response.headers.get("Retry-After")! }
        : {}),
    },
  });
}
