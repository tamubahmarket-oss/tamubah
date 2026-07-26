<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b377b9bc-962b-46f4-8055-7b256e5c88bd

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Migrating to Supabase + non-Vercel hosting (Option A)

This app now uses **Supabase** (Postgres) instead of the local `db.json` file,
and is designed to run as a plain, always-on Node/Express server — so it
works the same way on Render, Railway, Fly.io, a Docker host, or a bare VPS.
It no longer targets Vercel's serverless functions.

### 1. Create the Supabase project & schema

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run the contents of [`supabase/schema.sql`](supabase/schema.sql) once.
3. Go to **Settings → API** and copy your **Project URL** and **service_role key**
   (not the `anon` key — the server needs the service role key to bypass RLS).

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in:

- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — from step 1.
- `ADMIN_BOOTSTRAP_USERNAME`, `ADMIN_BOOTSTRAP_PASSCODE` — used **once**, only if
  `admin_users` is empty, to create your first admin login. After that, manage
  admin accounts from the Admin Panel's new **Admins** tab instead.

### 3. Migrate your existing data (if you have a `db.json`)

```bash
npm install
node scripts/migrate-to-supabase.mjs
```

This copies all sellers, products, reviews, reports, and stats into Supabase.
Existing plain-text seller passwords are hashed with bcrypt in the process —
nothing plain-text is written to Supabase.

### 4. Run it

```bash
npm run dev        # local development
npm run build && npm start   # production build, same as before
```

On first boot with an empty `admin_users` table, the server logs a message
confirming it created your bootstrap admin account from `.env`.

### 5. Deploy anywhere that runs Node

Any of these work out of the box (no vendor-specific code):

- **Render / Railway / Fly.io**: connect the repo, set the env vars from
  `.env.example` in their dashboard, build command `npm run build`, start
  command `npm start`.
- **Docker / VPS**: `docker build -t tamubah . && docker run -p 3000:3000 --env-file .env tamubah`
  (see the included `Dockerfile`).

### What changed for the Admin Panel

- **Admins tab (new)** — add/remove admin accounts and rotate your own
  passcode from inside the panel, instead of one shared `ADMIN_PASSCODE` env var.
- **Revisions tab** — each listing now also has a delete button, not just pin/unpin.
- **Logs tab** — each user report now has Resolve / Dismiss / Delete actions;
  resolved/dismissed reports drop out of the "needs attention" list automatically.
- Everything else (verifying sellers, approval, tiers, metrics) works exactly as before.
