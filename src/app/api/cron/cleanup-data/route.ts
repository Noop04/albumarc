import { NextRequest, NextResponse } from "next/server";

import { cleanupStaleData } from "@/lib/cron/cleanup-data";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cleanupStaleData();
  return NextResponse.json({ ok: true, ...result });
}
