import { lt } from "drizzle-orm";

import { getDb } from "@/lib/db";
import { analyticsEvents, recommendationHistory } from "@/lib/db/schema";
import { Logger } from "@/utils/logger";

const logger = new Logger("Cron:CleanupData");

export async function cleanupStaleData(): Promise<{
  historyDeleted: number;
  analyticsDeleted: number;
}> {
  const db = getDb();
  if (!db) {
    return { historyDeleted: 0, analyticsDeleted: 0 };
  }

  const historyCutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
  const analyticsCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const historyDeletedRows = await db
    .delete(recommendationHistory)
    .where(lt(recommendationHistory.recommendedAt, historyCutoff))
    .returning({ id: recommendationHistory.id });

  const analyticsDeletedRows = await db
    .delete(analyticsEvents)
    .where(lt(analyticsEvents.createdAt, analyticsCutoff))
    .returning({ id: analyticsEvents.id });

  const historyDeleted = historyDeletedRows.length;
  const analyticsDeleted = analyticsDeletedRows.length;

  logger.info("Data retention cleanup completed", {
    historyDeleted,
    analyticsDeleted,
    historyCutoff: historyCutoff.toISOString(),
    analyticsCutoff: analyticsCutoff.toISOString(),
  });

  console.log(
    JSON.stringify({
      event: "cron.cleanup_data",
      historyDeleted,
      analyticsDeleted,
    })
  );

  return { historyDeleted, analyticsDeleted };
}
