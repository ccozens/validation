# Journal

A calm, private daily journal PWA built with SvelteKit, TypeScript, Tailwind, and Firebase.  
Log thoughts throughout the day, generate an end-of-day reflection, and get a weekly summary — all powered by the Gemini API (free tier).

---

## What it does

- **Log entries** throughout the day — short free text, saved instantly to Firestore
- **End of day** button — Gemini reads the day's entries and produces a warm, validating reflection
- **Summarise my week** button — reviews the current Mon–Sun week and acknowledges all the invisible work
- **History view** — all previous days, grouped with daily summaries shown inline
- **Private** — Google sign-in, whitelisted to your email only

---

## Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- A [Firebase](https://firebase.google.com/) account (free)
- A [Google AI Studio](https://aistudio.google.com/) account (free Gemini API key)

---

## Step 1 — Get your Gemini API key

1. Go to [aistudio.google.com](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click **Get API key** → **Create API key**
4. Copy the key — you'll need it shortly

The free tier of Gemini 2.0 Flash is generous enough for personal journalling (thousands of requests per day).

---

## Step 2 — Set up Firebase

### 2a. Create a project

1. Go to [console.firebase.google.com](https://console.firebase.google.com/)
2. Click **Add project**, give it a name (e.g. `my-journal`), follow the steps
3. Disable Google Analytics if you don't want it — it's not needed

### 2b. Enable Authentication

1. In the Firebase console, go to **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in method**, enable **Google**
4. Set your project's public-facing name and support email, then save

### 2c. Create Firestore database

1. Go to **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode**
4. Pick a region close to you (e.g. `europe-west2` for UK)

### 2d. Set Firestore security rules

In **Firestore → Rules**, replace the default rules with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**.

### 2e. Get your Firebase config

1. In the Firebase console, click the **gear icon** → **Project settings**
2. Scroll down to **Your apps** → click **Add app** → choose the **Web** icon (`</>`)
3. Register the app (nickname: `journal-web`)
4. Copy the `firebaseConfig` values — you'll need all of them

### 2f. Add your domain to Authorised domains

1. Go to **Authentication → Settings → Authorised domains**
2. Your deployed domain will need to be added here once you deploy (e.g. `your-app.vercel.app`)
3. `localhost` is already there for local development

---

## Step 3 — Configure the app

1. Clone or download this repository
2. Copy the environment template:

```bash
cp .env.example .env
```

3. Open `.env` and fill in your values:

```env
# From Firebase project settings → Your apps → SDK setup
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=my-journal-xxxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=my-journal-xxxxx
VITE_FIREBASE_STORAGE_BUCKET=my-journal-xxxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123

# From Google AI Studio
VITE_GEMINI_API_KEY=AIza...

# Your Google account email — only this account can sign in
VITE_ALLOWED_EMAIL=you@gmail.com
```

---

## Step 4 — Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.  
Sign in with your Google account. If you see "not authorised", double-check `VITE_ALLOWED_EMAIL` in your `.env`.

---

## Step 5 — Deploy (recommended: Vercel)

This app builds to a static site, so it can be deployed anywhere that serves static files.

### Vercel (easiest)

1. Push the project to a GitHub repository
2. Go to [vercel.com](https://vercel.com/) and import the repository
3. In the Vercel project settings, add all your environment variables (same as `.env`)
4. Deploy

Vercel will give you a URL like `https://my-journal-abc123.vercel.app`.

5. Back in Firebase console → **Authentication → Settings → Authorised domains**, add your Vercel URL

### Netlify

Same process — import from GitHub, add environment variables, deploy.

---

## Step 6 — Add to your Android home screen (PWA)

1. Open the deployed URL in Chrome on your Android phone
2. Tap the three-dot menu → **Add to Home screen**
3. Tap **Add**

The app will now open full-screen from your home screen like a native app.

---

## Using the app

### During the day
Just type what's happening and tap **Save** (or Cmd/Ctrl + Enter).  
Entries are saved silently — no AI call, no friction.

### End of day
When you're done for the day, tap **End of day**.  
Gemini will read everything you logged and write a brief, warm reflection acknowledging what you actually did.

### Weekly summary
Tap **Summarise my week** at any point during or at the end of the week.  
Gemini reviews all entries from the current Monday–Sunday and produces a summary that names the categories of work and validates why free time was limited.  
You can regenerate it at any time.

### History
Tap **History** to see all previous days, grouped with daily summaries shown inline.

---

## Costs

| Service | Cost |
|---|---|
| Firebase Firestore (free tier) | Up to 50,000 reads / 20,000 writes per day — vastly more than needed |
| Firebase Authentication | Free |
| Gemini 2.0 Flash API (free tier) | Up to 1,500 requests per day — more than enough |
| Vercel / Netlify hosting | Free tier sufficient |

**Expected running cost: £0.**

---

## Troubleshooting

**"Not authorised" on sign-in**  
Check that `VITE_ALLOWED_EMAIL` exactly matches the Google account you're signing in with.

**Gemini API error**  
Make sure `VITE_GEMINI_API_KEY` is set correctly. Test the key at [aistudio.google.com](https://aistudio.google.com/).

**Firestore permission denied**  
Make sure the security rules in Step 2d have been published, and that you're signed in.

**Entries not loading**  
Check the browser console for errors. Most issues are misconfigured `.env` values.

**Google sign-in popup blocked**  
Allow popups for the app's domain in your browser settings.

---

## Project structure

```
src/
  lib/
    firebase.ts          # Firebase initialisation
    stores/
      auth.ts            # Auth state + sign in/out
      journal.ts         # Entries, summaries, Firestore sync
    utils/
      gemini.ts          # Gemini API calls + prompts
  routes/
    +layout.svelte       # Root layout, initialises auth
    +page.svelte         # Main app UI
  app.html               # HTML shell
  app.css                # Global styles + Tailwind
static/
  manifest.json          # PWA manifest
```
