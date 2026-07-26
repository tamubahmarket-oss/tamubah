# Deploying TAMU BAH (Render — recommended)

## Why the Vercel deployment was broken

`server.ts` is a single Express app that serves both your `/api/*` routes
(sellers, products, admin auth, etc.) **and** the built frontend, listening
on a port via `app.listen()`. That's the shape of a normal long-running
Node server — it needs a host that keeps a process alive, not a static-site
host.

The old `vercel.json` was a plain static-site config:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Vercel was never running your Express server or its API routes — it just
served the built `dist` folder and rewrote *every* request, including
`/api/sellers`, to `index.html`. That's why the frontend's `fetch` calls
were getting back an HTML page and choking with
`Unexpected token '<', "<!doctype "... is not valid JSON`.

This zip has `vercel.json` removed and a Render setup added instead, since
Render runs `server.ts` as-is with no rewrites needed.

## One-time setup

### 1. Push this project to GitHub
Render deploys from a git repo. If you don't already have one:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```
`.gitignore` already excludes `.env`, `node_modules`, and `dist` — don't
remove those.

### 2. Create the service on Render
1. Go to [render.com](https://render.com) → **New** → **Blueprint**.
2. Connect your GitHub repo. Render will detect `render.yaml` in this zip
   automatically and pre-fill the service (Node, build/start commands).
3. If you'd rather set it up manually instead of using the blueprint:
   - **New → Web Service**
   - Environment: **Node**
   - Build command: `npm install && npm run build`
   - Start command: `npm start`

### 3. Set environment variables
In the Render dashboard, under your service → **Environment**, add:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service role key |
| `ADMIN_BOOTSTRAP_USERNAME` | your first admin's username |
| `ADMIN_BOOTSTRAP_PASSCODE` | your first admin's passcode |

Pull the real values from wherever you've stored them securely — **do not**
commit a real `.env` file to git. `.env.example` in this zip shows the
shape only, with placeholder values.

> Since your previous `.env` (with real Supabase and admin credentials) was
> shared in this chat, it's good practice to rotate the Supabase service
> role key and the admin passcode afterward, just so nothing that passed
> through a chat session stays live indefinitely.

### 4. Deploy
Click **Create Web Service**. Render will build and start the app; you'll
get a URL like `https://tamubah.onrender.com`. First deploy takes a few
minutes.

### 5. Retire the old Vercel project
Once Render is confirmed working, delete or pause the Vercel project so
there's no confusion about which URL is live.

## Local development (unchanged)
```bash
cp .env.example .env   # then fill in real values
npm install
npm run dev
```

## Notes on the free tier
Render's free web services spin down after ~15 minutes of inactivity and
take a few seconds to wake back up on the next request. If that cold-start
delay matters for your users, upgrade to a paid instance type later — no
code changes required.
