export class SpotifyTokenRevokedError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "SpotifyTokenRevokedError";
  }
}

export function isTokenRevocationStatus(status: number): boolean {
  return status === 400 || status === 401;
}
