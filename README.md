# Plainhand

A free writing check for students, written in TypeScript. It marks passages that read like machine writing, explains why, and builds an AI-use declaration. Everything runs in the browser. There is no server, no account and no analytics.

Pages: Home, Check, Declare, Guide, About, Privacy, Terms.

## Run it

```
npm install
npm run typecheck   # tsc --noEmit
npm test            # analyzer and declaration tests
npm run build       # writes dist/
npm run watch       # rebuilds on change
```

Open `dist/index.html`, or upload the `dist` folder to any static host (Netlify, Cloudflare Pages, GitHub Pages, Vercel).

## Layout

```
src/analyzer.ts      the writing signals and scoring
src/declaration.ts   builds the AI-use statement
src/timer.ts         the 4 hours a day allowance
src/storage.ts       local storage, with validation on read
src/pages/*.ts       one file per page
src/styles.css       cream, navy and butter-yellow theme (light and dark)
```

## Security and privacy

- No backend, so no database to breach and no user data in transit.
- `dist/index.html` ships a strict Content Security Policy (no inline scripts, no network requests from the app, no framing).
- All user text is escaped before it is shown. Stored data is validated when read back. Dropped files (Word, PDF, PowerPoint, OpenDocument, RTF, HTML, text) are size-limited and read in the browser, never uploaded. Scanned images are not read.
- Fonts come from Google Fonts. To remove that third party, download the three families, serve them from `dist/`, and delete the two Google lines from the CSP in `scripts/build.mjs`.
- If your host lets you set response headers, send the same policy as a header and add:
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Strict-Transport-Security: max-age=31536000`.
- Before launch, fill in the bracketed details in `src/pages/privacy.ts` and `src/pages/terms.ts` and have a lawyer review them.

## Reviews

The Reviews page and the reviews on the Home page start empty. Nothing is pre-filled and no sample reviews are shipped.

Without a shared service, a review is saved in the writer's own browser only and the page says so. To let every visitor see approved reviews:

```
# 1. run the review service somewhere (any Node 18+ host)
ALLOWED_ORIGIN=https://your-site.example ADMIN_TOKEN=$(openssl rand -hex 32) node server/reviews-server.mjs

# 2. rebuild the site pointing at it
REVIEWS_URL=https://reviews.your-host.example npm run build
```

New reviews are held as pending. Approve or remove them with your admin token:

```
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://reviews.your-host.example/admin/pending
curl -X POST   -H "Authorization: Bearer $ADMIN_TOKEN" https://reviews.your-host.example/admin/approve/<id>
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" https://reviews.your-host.example/admin/reviews/<id>
```

The service rate-limits by IP in memory (5 reviews an hour), ignores a hidden honeypot field, caps request size, and never stores IP addresses. The build adds the service's origin to the site's Content Security Policy.

## The 4 hour limit

The allowance is counted in the browser, per device and per day, and goes down whenever the site is open and visible. It is a fair-use guide, not a hard lock: clearing site data resets it. A hard limit needs sign-in and a server that keeps the count.

## What it is not

It is not Turnitin and does not connect to any university system. It cannot predict a detector's score. It does not rewrite text or help hide AI-written text from detectors.
