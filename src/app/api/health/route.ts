import { NextResponse } from "next/server";

import { isDatabaseConfigured } from "@/lib/db";
import { isSpotifyConfigured } from "@/lib/spotify/config";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      spotify: isSpotifyConfigured(),
      database: isDatabaseConfigured(),
    },
  });
}
