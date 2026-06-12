import { createHash } from "crypto";

export function trackUrisHash(uris: string[]): string {
  const sorted = [...uris].sort();
  return createHash("sha256").update(sorted.join("\n")).digest("hex");
}
