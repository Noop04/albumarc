import { NextResponse } from "next/server";

import { getUserProfile } from "@/lib/spotify/client";
import { getSpotifySession } from "@/lib/spotify/session";

export async function GET() {
  const session = await getSpotifySession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  if (session.displayName !== undefined) {
    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.spotifyUserId,
        name: session.displayName,
        imageUrl: session.imageUrl,
      },
    });
  }

  try {
    const profile = await getUserProfile();
    return NextResponse.json({
      authenticated: true,
      user: {
        id: profile.id,
        name: profile.display_name,
        imageUrl: profile.images[0]?.url,
      },
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}
