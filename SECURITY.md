# Security Policy

## Supported Versions

Security fixes are applied to the latest release on the `main` branch.

| Version | Supported |
| ------- | --------- |
| latest  | yes       |

## Reporting a Vulnerability

If you discover a security issue, please report it privately rather than opening a public GitHub issue.

**Preferred:** use [GitHub Security Advisories](https://github.com/Noop04/albumarc/security/advisories/new) if you have access to the repository.

**Alternative:** open a private security advisory or contact the maintainer through GitHub.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce
- Affected versions or commits (if known)
- Any suggested fix or mitigation

You can expect an initial response within **7 days**. We will work with you to understand the issue, develop a fix, and coordinate disclosure.

## Scope

In scope:

- Authentication and session handling (OAuth, encrypted cookies)
- API authorization and rate limiting
- Cron endpoint protection (`CRON_SECRET`)
- SQL injection or unsafe database access
- Cross-site scripting (XSS) and content security policy bypasses
- Exposure of secrets, tokens, or user data

Out of scope:

- Issues in third-party services (Spotify, Neon, Upstash, Vercel)
- Social engineering or phishing
- Denial-of-service attacks that rely solely on high request volume
- Vulnerabilities in dependencies with no available fix (please still report; we may track them)

## Security Best Practices for Self-Hosting

If you deploy your own instance:

- Set strong, unique values for `SESSION_SECRET` and `CRON_SECRET` (32+ characters)
- Never commit `.env.local` or production credentials
- Use a **pooled** PostgreSQL connection string in serverless environments
- Restrict Spotify app redirect URIs to your production domain only
- Keep dependencies updated (`npm audit`, regular releases)
