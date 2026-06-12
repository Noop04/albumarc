import { getServerAnalyticsSessionId, getSpotifySession } from "@/lib/spotify/session";

export async function resolveAnalyticsSessionId(): Promise<string | undefined> {
  const session = await getSpotifySession();
  return getServerAnalyticsSessionId(session);
}
