export function contentSecurityPolicy(): string {
  const isDev = process.env.NODE_ENV === "development";

  const scriptSrc = ["'self'", "'unsafe-inline'", "https://sdk.scdn.co"];
  if (isDev) {
    scriptSrc.push("'unsafe-eval'");
  }

  const connectSrc = [
    "'self'",
    "https://api.spotify.com",
    "https://accounts.spotify.com",
    "https://*.upstash.io",
    "wss://dealer.spotify.com",
    "https://*.spotify.com",
  ];
  if (isDev) {
    connectSrc.push("ws:", "wss:");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://i.scdn.co https://mosaic.scdn.co data:",
    `connect-src ${connectSrc.join(" ")}`,
    "media-src 'self' https://p.scdn.co blob:",
    "frame-src 'self' https://sdk.scdn.co https://open.spotify.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}
