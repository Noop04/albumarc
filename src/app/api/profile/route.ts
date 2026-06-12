import { NextResponse } from "next/server";

import { getCachedProfile } from "@/lib/cache/profile";
import { getMusicProfile } from "@/lib/profile/get-profile";
import { toPublicError } from "@/lib/security/errors";
import { getSpotifySession } from "@/lib/spotify/session";
import { resolveAppUser } from "@/lib/users/resolve";

export async function GET() {
  const session = await getSpotifySession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const appUser = await resolveAppUser();
    if (!appUser) {
      return NextResponse.json({ error: "User profile unavailable" }, { status: 503 });
    }

    const cached = await getCachedProfile(appUser.id);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const profile = await getMusicProfile(appUser.id);
    return NextResponse.json({ ...profile, cached: false });
  } catch (error) {
    return NextResponse.json(
      { error: toPublicError(error, "Failed to load music profile") },
      { status: 500 }
    );
  }
}
