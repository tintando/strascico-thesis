# Hosting the deck

Two ways to get the deck onto a machine that is not this one: publish it behind a Cloudflare tunnel, or hand over a single HTML file.

## Publishing

```
node deploy/build.mjs                                   # slides/ → dist/
docker compose -f deploy/compose.yml up -d --build      # publish dist/
```

Two containers, a separate compose project from the dev server: `tgdataset2-public` (nginx) and `tgdataset2-public-tunnel` (cloudflared). The container names say what is on the internet. Anything named `public` is reachable from outside; `tgdataset2-dev` is not, and the naming is the whole safeguard against confusing them at 2am.

No inbound port is open. Cloudflare reaches nginx through the tunnel, and the site is live only while Docker runs on the host. The published site is static all the way down: nginx serves files and nothing else, with no write endpoint, no shared secret and no server-side state, so there is nothing a visitor can change. The speaker notes ship in the open as part of that trade, since making them private would have required exactly the server-side state this design does without.

## Supplying a tunnel

The tunnel in this repository is a placeholder. Put your own UUID and hostname in `deploy/cloudflared/config.yml`, and its credentials at `deploy/cloudflared/credentials.json`, or point `$TUNNEL_CREDENTIALS` at one. The credentials file is a gitignored copy of `~/.cloudflared/<uuid>.json` rather than a mount of the original, because Docker only mounts paths it shares and the home directory is not one of them. Deleting the tunnel revokes them.

```
SITE_URL=https://your.host node deploy/build.mjs
```

sets the canonical and Open Graph URLs to match.

## What the build does

`dist/` is baked into the image, not bind-mounted. A running container is frozen at the build it came from, so editing a slide changes nothing publicly until both commands run again. That is the point: the alternative, a live mount, means an unfinished edit is on the internet the moment it hits disk.

The build inlines the fragments into `index.html`, so the published deck needs neither `/api/slides` nor live reload. It drops all comments, bundles and minifies the CSS and JS, content-hashes every asset so `index.html` can be no-cache while the assets stay immutable for a year, emits `sw.js` (a service worker: after one online visit the deck and its notes keep working offline), and renders `og.png` for link previews. Rendering `og.png` from the built deck doubles as a smoke test that `dist/` actually runs.

## Portable copy

For a foreign machine with no network and no Node, one self-contained file:

```
node deploy/build.mjs --portable      # → portable/tgdataset2-deck.html (~360 KB)
```

CSS, JS, both fonts, the Classic wallpaper and all 16 fragments are inlined as data URIs, so the file opens by double-click over `file://` and keeps everything: the four themes, 16:9 and 4:3, the live clock, the rail, touch gestures, PDF export, and the speaker-notes panel on `N`.

Two-window follow mode works too, verified in Chrome and Firefox, where two windows of the same file share `localStorage` and its `storage` event. In Firefox both windows must open the same file path, since it gives each `file://` document its own storage origin. Safari refuses storage on `file://` altogether, so there the deck loses follow mode and last-slide memory: use Chrome, or the PDF.

The portable build reuses the public build's fragment baking, so the two cannot drift, and `#stage`'s `data-portable` attribute is the only signal `deck.js` reads to drop the service worker.
