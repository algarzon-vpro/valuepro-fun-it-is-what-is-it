# It is what is it?

Real-time multiplayer drawing & guessing game — neon arcade edition.

UX shell patterned after [The Watcher](https://valuepro-fun-watcher.vercel.app): fullscreen app, brand-first home menu, room codes, overlay HUD, CRT vibe.

## Stack

- **Client:** React + TypeScript + Vite
- **Server:** Node.js + Express + Socket.IO
- **Shared:** Game types, word bank, scoring helpers

## Quick start

```bash
npm install
npm run dev
```

- Client: http://localhost:5173  
- Server: http://localhost:3001  

Open two browser windows (or one normal + one private). Create a room in one, join with the code in the other.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Client + server together |
| `npm run build` | Production build |
| `npm start` | Run built server (serve client `dist` if configured) |
| `npm run typecheck` | Typecheck all workspaces |

## Features

- Private rooms + join codes
- Host settings: round duration, rounds, max players
- Roles: drawer / guesser / spectator (promote when a slot opens)
- Server-authoritative secret word (drawer only)
- Real-time canvas: brush, size, colors, eraser, undo, clear, stroke interpolation
- Chat guesses: wrong = public, correct = system message + Top Guessers rank
- Round results + final scoreboard with guess-order points and drawer bonus
- Reconnect via local session

## Deploy (like The Watcher on Vercel)

[The Watcher](https://valuepro-fun-watcher.vercel.app) is a **static Vite SPA** — one Vercel project is enough.

This game also needs a **always-on Socket.IO server** (rooms live in memory). Deploy in two pieces:

| Piece | Where | Why |
|-------|--------|-----|
| `client/` | **Vercel** | Same as Watcher |
| `server/` | **Railway / Render / Fly.io** | Long-lived WebSockets + in-memory game state |

Suggested Vercel project name: `valuepro-fun-it-is-what-is-it`.

### 1. Game server (Railway example)

1. Create a new Railway (or Render/Fly) service from this repo.
2. **Root directory / start:**
   - Build: `npm install && npm run build -w shared && npm run build -w server`
   - Start: `npm run start -w server`
3. Set env:
   - `CLIENT_ORIGIN=https://valuepro-fun-it-is-what-is-it.vercel.app`
4. Copy the public HTTPS URL (e.g. `https://….up.railway.app`).

### 2. Frontend on Vercel

From the repo root (or connect the GitHub repo in the Vercel dashboard):

```bash
npx vercel
```

- Framework: **Other** (uses root `vercel.json`)
- Build output: `client/dist`
- Env var: `VITE_SOCKET_URL=https://your-railway-url` (no trailing slash)
- Redeploy after setting the env (Vite bakes it in at build time)

### Why not 100% on Vercel?

Vercel can do WebSockets now, but each connection can land on a **different function instance**. Our rooms are an in-memory `Map`, so players in the same room must hit the same process — that needs Redis (or similar) if you go all-Vercel. The hybrid setup above matches Watcher’s Vercel frontend with almost no architecture change.

## Project layout

```
it-is-what-is-it/
  client/   React UI → Vercel
  server/   Socket.IO game server → Railway / Render / Fly
  shared/   Shared types & word list
  vercel.json
```
