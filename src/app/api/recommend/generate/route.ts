import type { NextRequest } from "next/server";

import { handleRecommendGenerate } from "@/lib/recommendations/handler";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleRecommendGenerate(request);
}
