import { Ratelimit } from "@upstash/ratelimit";

import { getRedis } from "@/lib/cache/redis";

type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

const rateLimiters = new Map<string, Ratelimit>();

export type RateLimitResult = {
  limited: boolean;
  retryAfterSec: number;
};

function getUpstashLimiter(name: string, limit: number, windowSec: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  const key = `${name}:${limit}:${windowSec}`;
  const existing = rateLimiters.get(key);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    prefix: `albumarc:rl:${name}`,
  });

  rateLimiters.set(key, limiter);
  return limiter;
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

function memoryRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  if (bucket.count >= limit) {
    return {
      limited: true,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { limited: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
}

export async function checkRateLimit(
  name: string,
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(name, limit, windowSec);

  if (limiter) {
    const result = await limiter.limit(key);
    const retryAfterSec = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000)
    );
    return { limited: !result.success, retryAfterSec };
  }

  return memoryRateLimit(`${name}:${key}`, limit, windowSec * 1000);
}

export async function isRateLimited(
  name: string,
  key: string,
  limit: number,
  windowSec: number
): Promise<boolean> {
  const result = await checkRateLimit(name, key, limit, windowSec);
  return result.limited;
}

export function rateLimitResponse(retryAfterSec = 60): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}
