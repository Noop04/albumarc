import { NextRequest, NextResponse } from "next/server";

import { refreshStalePlaylists } from "@/lib/cron/refresh-playlists";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshStalePlaylists();
  return NextResponse.json({ ok: true, ...result });
}
