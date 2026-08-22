# Exceptional Release — Live Memory Wall

A live guestbook: visitors add their name, a note, and/or a photo, and it appears
on the wall instantly for everyone viewing (no login required). Plain HTML/CSS/JS —
no build step — deployed to Vercel, backed by Firebase.

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com → **Add project** → name it whatever
   you like → finish the wizard (Google Analytics is optional, skip it).
2. In the left sidebar: **Build → Firestore Database → Create database**.
   - Start in **production mode** (we'll set custom rules below).
   - Pick a region close to you.
3. In the left sidebar: **Build → Storage → Get started**.
   - Also production mode, same region.
4. In the left sidebar: **Project settings** (gear icon) → scroll to **Your apps**
   → click the **</>** (web) icon → register an app (nickname doesn't matter,
   no need to set up Hosting).
5. Firebase shows you a `firebaseConfig` object. Copy it.

## 2. Add your config

Open `firebase-config.js` in this project and paste your values in, replacing
the placeholders:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

This file is safe to commit — Firebase web config is not a secret; access is
controlled by the security rules below, not by hiding this key.

## 3. Set security rules

**Firestore** — console → Firestore Database → Rules tab → paste in the contents
of `firestore.rules` from this project → **Publish**.

**Storage** — console → Storage → Rules tab → paste in the contents of
`storage.rules` from this project → **Publish**.

These rules let anyone read and add entries (no login), cap photos at 8MB,
and block anyone from editing or deleting existing entries — so nothing on
the wall can be tampered with once posted, only added to.

## 4. Add your places served (map)

The wall includes a map of bases and deployments, connected by a dashed line.
It's plain Leaflet + OpenStreetMap tiles — free, no API key.

Open `app.js` and edit the `LOCATIONS` array near the top:

```js
const LOCATIONS = [
  { name: 'Lackland AFB, TX', lat: 29.3843, lng: -98.6205, years: '2006–2006 · Basic Training' },
  { name: 'Ramstein AB, Germany', lat: 49.4369, lng: 7.6003, years: '2007–2010' },
  // add as many as you like, roughly in chronological order
];
```

To find coordinates for a base: search it in Google Maps, right-click the
pin, and click the lat/lng shown at the top of the menu to copy it. Leave
`LOCATIONS` as an empty array (`[]`) to hide the map section entirely.

## 5. Personalize the page

In `index.html`, find the `<div id="config">` block near the top and edit the
`data-*` attributes:

```html
<div id="config" hidden
  data-name="Your Name"
  data-branch="U.S. Air Force"
  data-years="20"
  data-closing-date="2026"
  data-eyebrow="Service Record — Closing Entry">
</div>
```

## 6. Deploy to Vercel

**Option A — Vercel CLI**
```bash
npm i -g vercel
cd retirement-wall
vercel
```
Follow the prompts (link or create a project, accept defaults — it's a static
site, no build command needed).

**Option B — GitHub + Vercel dashboard**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```
Then in https://vercel.com/new, import the repo. Framework preset: **Other**.
No build command, no output directory override needed — it deploys as-is.

## Notes

- **Moderation**: entries go live immediately, there's no approval step. If you
  want to remove something later, delete the document directly in the Firestore
  console (Build → Firestore Database → `entries` collection).
- **Photo size**: capped at 8MB client-side and enforced again by Storage rules.
- **Costs**: Firebase's free (Spark) tier comfortably covers a personal
  guestbook like this — you're very unlikely to hit any limits.
