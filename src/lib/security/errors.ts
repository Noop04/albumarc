function spotifyStatusFromMessage(message: string): number | null {
  const match = message.match(/\((\d{3}):/);
  return match ? Number(match[1]) : null;
}

export function toPublicError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;

  const message = error.message;
  const spotifyStatus = spotifyStatusFromMessage(message);

  if (message.includes("Not authenticated") || message.includes("session expired")) {
    return message;
  }

  if (message.includes("Reconnect Spotify") || message.includes("Premium")) {
    return message;
  }

  if (spotifyStatus === 403) {
    return "Reconnect Spotify to grant playlist permissions.";
  }

  if (spotifyStatus === 401) {
    return "Spotify session expired. Please reconnect.";
  }

  if (spotifyStatus === 429) {
    return "Spotify rate limit hit. Please wait a moment and try again.";
  }

  if (message.includes("Spotify API error 429") || message.includes("rate limit")) {
    return "Spotify rate limit hit. Please wait a moment and try again.";
  }

  if (message.includes("Spotify API error") || message.includes("token")) {
    return fallback;
  }

  if (message.includes("Failed to") && spotifyStatus) {
    return fallback;
  }

  return message.length > 200 ? fallback : message;
}
