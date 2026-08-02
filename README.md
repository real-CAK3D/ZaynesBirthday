# Zayne's 13th Birthday Invite

Animated digital invite for Zayne's 13th birthday party at Range Pond in Poland, Maine.

## What is included

- Scroll-driven 3D invitation cube.
- Unfolding birthday card section.
- RSVP form with live going count.
- SMS fallback links for the RSVP/contact numbers.
- Lightweight Node preview/backend with no npm dependencies.

## Party facts included

- Zayne is turning 13.
- Location: Range Pond in Poland, Maine.
- Date: August 15.
- Time: anytime after 12 PM, ending around 3–4 depending on weather.
- Running, sports, minute-to-win-it games, and beach activities.
- Burgers, hot dogs, and food provided for kids.
- Bring swimsuit, towel, and sneakers.
- Parents are welcome; kids are covered, parents pay for themselves.
- RSVP by August 12.

## Run locally

```bash
npm start
# open http://127.0.0.1:4173
```

Or without npm:

```bash
node server.js
```

## Verify syntax

```bash
npm run check
```

## GitHub Pages note

This invite can be pushed to a GitHub repo as a static site because `index.html`, `styles.css`, and `script.js` work by themselves.

Important RSVP detail: GitHub Pages is static, so it cannot save shared RSVPs by itself. On GitHub Pages, the form will fall back to browser-local demo storage and SMS links. For the live shared count and real saved RSVPs, host `server.js` somewhere that can run Node, or wire the form to Vercel/Supabase/Twilio/Telnyx/CAK3D SMS gateway after approval.

## RSVP behavior

- With `node server.js`, the page posts RSVPs to `/api/rsvp`.
- RSVP data is stored in local `rsvps.json`, which is intentionally gitignored.
- The visible going count refreshes every 15 seconds.
- If no backend is available, the page falls back to browser `localStorage` and provides SMS links.
- Automatic SMS is intentionally not enabled in this local prototype. Wire an approved SMS provider in `maybeNotifyPhones()` only after approval.
