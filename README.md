# Events Around

Discover nearby Ticketmaster events; dive into rich Event, Artist, and Venue detail views; and curate a personal Favorites list. Built as a clean, accessible single‑page app (React + TypeScript + Vite) with an Express backend proxying Ticketmaster and Spotify plus persistence for favorites.

## Overview
The frontend consumes backend `/api` endpoints (Express) that proxy Ticketmaster & Spotify and store favorites in MongoDB. React Query provides resilient fetch + cache; sessionStorage preserves search context across navigations; responsive Tailwind utilities keep desktop layouts stable while remaining mobile‑friendly.

## Frontend Stack
- React 18, TypeScript, Vite
- React Router (SPA routing)
- React Query (data fetching & caching)
- React Hook Form (search form handling/validation)
- Tailwind CSS (utility-first styling)
- Sonner (toast notifications)
- Lucide Icons

## Backend Endpoints
| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/health` | Health probe |
| GET | `/api/suggest?keyword=` | Ticketmaster type‑ahead suggestions |
| GET | `/api/events` | Event search (keyword, category, radius, geohash) |
| GET | `/api/event/:id` | Full event details |
| GET | `/api/venue/:id` | Venue details |
| GET | `/api/spotify/artist?name=` | Spotify artist lookup |
| GET | `/api/spotify/artist/:id/albums` | Albums for artist |
| GET | `/api/favorites?userId=` | List favorites |
| POST | `/api/favorites` | Add favorite (idempotent via upsert) |
| DELETE | `/api/favorites/:eventId?userId=` | Remove favorite |

MongoDB collections: `favorites` (unique index on `{ userId, eventId }`).

## Key Features
1. Search
   - Keyword, category, distance, location (manual or auto‑detect IP → lat/lon).
   - Autocomplete suggestions (Ticketmaster suggest API) with graceful fallback.
   - Durable search state (results + form values + hasSearched) via sessionStorage; only cleared on a hard reload of `/search`.
2. Event Detail Tabs
   - Info (dates, artists/teams, venue, genres, price ranges, ticket status, seatmap, social share).
   - Artist (Spotify: followers, popularity, genres, albums grid) displayed only for music segment.
   - Venue (image if present, address → Google Maps, parking/general/child rules) with adaptive 2‑column layout.
3. Favorites
   - Consistent cards; undo remove via toast action; persistent per generated userId stored in localStorage.
4. Layout Consistency
   - Desktop tab bodies stabilized with a shared min‑height utility; scrollbar gutter prevents width shifts.
5. Accessibility / UX
   - Semantic buttons with `aria-label`; keyboard‑safe custom listbox for Category; clear empty states.

## Directory Structure
```
frontend/
  src/
	 App.tsx           # Global layout (nav + width container)
	 main.tsx          # Router + QueryClient + hard reload detection
	 index.css         # Tailwind directives + minimal globals
	 routes/
		Search.tsx      # Search form + results
		EventDetail.tsx # Tabs: Info / Artist / Venue
		Favorites.tsx   # Favorites grid + empty state
	 lib/
		api.ts          # Fetch helpers (events, venue, spotify, geolocation)
		favorites.ts    # Favorites CRUD + user id helper
process_log.txt       # Latest refinement steps
README.md             # This file
```

## Installation & Setup

### Frontend
```bash
cd frontend
npm install
```

### Backend
```bash
cd backend
npm install
```

## Development

In two terminals:
```bash
# Backend
cd backend
npm run start

# Frontend
cd frontend
npm run dev
```
Frontend dev server: http://localhost:5173 (proxying `/api` to backend port 8080).

## Production Build
```bash
cd frontend
npm run build
```
Static assets emitted to `frontend/dist`. The backend `index.js` serves these if deployed together.

## Environment Variables

### Frontend `.env`
```
VITE_GOOGLE_MAPS_API_KEY=your_key_optional
VITE_IPINFO_TOKEN=your_ipinfo_token_optional
```
Both optional; absence disables geocoding or precise IP location gracefully.

### Backend `.env`
```
PORT=8080
TM_API_KEY=your_ticketmaster_key
SPOTIFY_CLIENT_ID=spotify_client_id
SPOTIFY_CLIENT_SECRET=spotify_client_secret
MONGODB_URI=your_mongodb_connection_string
MONGODB_DB=hw3
ALLOWED_ORIGIN=http://localhost:5173
NODE_ENV=production
```

## Recent Cleanup Highlights
* Unified global width: `site-container` (`w-full` mobile → `w-4/5` desktop) for consistent centering.
* Added scrollbar gutter rules to avoid horizontal jumps when vertical scroll appears.
* Introduced `tab-body` utility to normalize tab heights and visual stability.
* Manual date/time formatting to avoid timezone parsing discrepancies.
* Hard reload detection limited to `/search` path to preserve results when using back/forward navigation.
* Custom listbox replaces native select for Category to avoid OS oversized dropdown rendering.

## Design Decisions
* Manual date formatting avoids local timezone rollovers and matches target spec.
* Lightweight backend proxies external APIs, enabling consistent response shaping and caching control.
* Favor small utility abstractions (.site-container, .tab-body) over deep component hierarchy for clarity.
* Session vs local storage: sessionStorage for transient search state; localStorage for persistent user identity.

## Potential Next Steps
* Add Jest/React Testing Library for date formatting and favorites flows.
* Progressive enhancement: skeleton loaders & error boundaries.
* Abstract date/time formatting into shared utility (maintain output parity).
* Deploy separate frontend (static hosting) + backend (Render / GCP Cloud Run) with CORS tightening.
* Accessibility pass: keyboard navigation for suggestion list; focus rings.

## Deployment (GitHub + GCP)
1. Commit and push repository to GitHub (add a license first – MIT recommended).
2. Backend Deployment Options:
	- GCP Cloud Run: build container (Node 20), set env vars securely, mount no volumes, enable HTTPS.
	- GCP App Engine (Flexible): define `app.yaml` (runtime node, env vars).
3. Frontend Options:
	- Serve via backend static middleware (current setup) after `npm run build` inside CI/CD.
	- Or deploy separately (Cloud Storage + CDN) and point environment at backend API URL.
4. Set `ALLOWED_ORIGIN` to deployed frontend domain; remove wide-open CORS.
5. Monitor logs (Cloud Logging / CloudRun) for upstream API failure rates.

### Minimal Cloud Run Dockerfile (example)
```Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev
COPY backend backend
COPY frontend frontend
RUN cd frontend && npm ci && npm run build && rm -rf node_modules src
ENV NODE_ENV=production
WORKDIR /app/backend
EXPOSE 8080
CMD ["node", "src/index.js"]
```
Build with `gcloud builds submit` then deploy: `gcloud run deploy events-around --image IMAGE_URL --platform managed --allow-unauthenticated`.

## Security & Secrets
Never commit real API keys. Use environment variables. Apply least privilege: restrict Ticketmaster key by referrer if possible; rotate Spotify credentials periodically. Ensure MongoDB user has only required CRUD on target database.

## License
MIT (recommended) – add `LICENSE` file prior to public release.

## Maintainer Notes
Keep `process_log.txt` chronological; avoid breaking output formats consumed by frontend types. Run `npm audit` quarterly; pin any new dependencies.

---
Ready for GitHub + GCP deployment; no core functionality altered during cleanup.
