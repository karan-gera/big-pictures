# bigpictures

A simple tool to grab high-res album artwork. Nothing fancy - just search and download.

Live at [bigpictures.xyz](https://bigpictures.xyz).

## What it does

- Looks up album art from iTunes, Last.fm, Discogs, and MusicBrainz
- Opens the biggest image it can find when you click a result
- Falls back to the next source if one fails or comes up empty
- Has dark/light modes because why not
- Remembers your recent searches
- Works on phones too

## How it works

```
browser ──► iTunes Search API              (direct: no key needed, and Apple blocks Cloudflare IPs)
        └─► Cloudflare Worker ──► Last.fm  (the worker holds the API keys)
                              ├─► Discogs
                              └─► MusicBrainz + Cover Art Archive
```

- `src/` is the React app (Vite), deployed to GitHub Pages.
- `src/utils/albumSearch.js` does the searching and fallback. Each search tries iTunes, then Last.fm, Discogs, and MusicBrainz, stopping at the first one with results.
- `worker/` is the Cloudflare Worker (`album-search-api`). It keeps the API keys off the client, only answers browsers on bigpictures.xyz and localhost, and caches results at the edge for 6 hours.

## Getting started

Needs Node 22.13+, 24, or 26+ (`.nvmrc` pins 24); Vitest skips Node 25.

```bash
npm install
npm run dev
```

Visit localhost:3000. The app uses the deployed worker by default. To point it at a local one instead:

```bash
VITE_WORKER_URL=http://localhost:8787 npm run dev
```

- `npm test` runs the tests (Vitest, in watch mode; `npm test -- --run` runs once)
- `npm run lint` runs ESLint
- `npm run build` builds to `build/`, and `npm run preview` serves that build

## Working on the worker

```bash
cd worker
npm install
npx wrangler dev        # runs on localhost:8787
```

Last.fm and Discogs need keys. For local dev, put them in `worker/.dev.vars` (gitignored):

```
LASTFM_API_KEY=...
DISCOGS_KEY=...
DISCOGS_SECRET=...
```

In production they're Cloudflare secrets (`npx wrangler secret put LASTFM_API_KEY`).

## Deploying

- **Site:** merging to `master` deploys it. GitHub Actions lints, tests, and builds, then publishes to GitHub Pages. You can also run the CI workflow by hand from the Actions tab. This needs Settings → Pages → Source set to **GitHub Actions**; the custom domain and HTTPS are also managed there.
- **Worker:** still manual, `cd worker && npx wrangler deploy`. CI only checks that it bundles.

Every pull request runs the same lint, test, and build checks. Dependabot opens weekly update PRs for npm packages and Actions.

## Cache stuff

The browser keeps your last 20 searches for an hour in localStorage, and the worker caches results at the edge for 6 hours. Both save API calls, which matters because these APIs rate-limit hard.

## Made by

curroscube
