require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;
const { getCollection } = require('./db');
const qs = require('node:querystring');

app.use(morgan('dev'));
app.use(express.json());

// CORS for local dev (use same-origin in production)
if (process.env.NODE_ENV !== 'production') {
  app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:5173' }));
}

// Health endpoint for grading/sample JSON
app.get('/api/health', (req, res) => {
  res.json({ ok: true, name: 'hw3-backend', time: new Date().toISOString() });
});

// Placeholder endpoints (to be implemented next)
// Helpers
function tmHeaders() {
  const apiKey = process.env.TM_API_KEY;
  if (!apiKey) return {};
  // Some TM docs show query param; assignment hints mention headers – supply both safely.
  return {
    'Accept': 'application/json',
    'Accept-Encoding': 'identity',
    'User-Agent': 'hw3-backend',
    'x-api-key': apiKey,
    'apikey': apiKey,
  };
}

function pickEventCardFields(ev) {
  return {
    id: ev.id,
    name: ev.name,
    dateLocal: ev?.dates?.start?.localDate || null,
    timeLocal: ev?.dates?.start?.localTime || null,
    image: Array.isArray(ev.images) && ev.images.length ? ev.images[0].url : null,
    venueName: ev?._embedded?.venues?.[0]?.name || null,
    category: ev?.classifications?.[0]?.segment?.name || null,
    url: ev?.url || null,
  };
}

app.get('/api/suggest', async (req, res) => {
  try {
    const keyword = (req.query.keyword || '').toString().trim();
    if (!keyword) return res.json({ suggestions: [] });
    const params = new URLSearchParams({ keyword });
    if (!process.env.TM_API_KEY) {
      // Allow running without key (returns empty suggestions) but not erroring
      return res.json({ suggestions: [] });
    }
    params.set('apikey', process.env.TM_API_KEY);
    const url = `https://app.ticketmaster.com/discovery/v2/suggest?${params.toString()}`;
    const r = await fetch(url, { headers: tmHeaders() });
    if (!r.ok) {
      return res.status(r.status).json({ error: 'Upstream suggest failed' });
    }
    const data = await r.json();
    // Collect names from attractions/venues/events if present
    const suggestions = new Set();
    const add = (name) => { if (name && suggestions.size < 10) suggestions.add(name); };
    const _emb = data?._embedded || {};
    (_emb.attractions || []).forEach(a => add(a.name));
    (_emb.venues || []).forEach(v => add(v.name));
    (_emb.events || []).forEach(e => add(e.name));
    // Ensure typed value appears first per rubric
    const list = [keyword, ...Array.from(suggestions).filter(s => s.toLowerCase() !== keyword.toLowerCase())];
    return res.json({ suggestions: list.slice(0, 10) });
  } catch (e) {
    console.error('suggest error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const { keyword = '', segmentId, radius: radiusRaw, distance, unit = 'miles', lat, lon, location } = req.query;
    const radius = (radiusRaw ?? distance ?? '10').toString();
    const kw = keyword.toString().trim();
    if (!kw) return res.status(400).json({ error: 'keyword required' });
    if (!process.env.TM_API_KEY) return res.status(500).json({ error: 'TM_API_KEY missing' });

    // Determine lat/lon based on priority: direct lat/lon > location > IP-based
    let finalLat = lat;
    let finalLon = lon;

    // If lat/lon not provided directly, check location parameter
    if (!finalLat || !finalLon) {
      const locationStr = (location || '').toString().trim();
      
      if (locationStr && locationStr !== 'Current Location') {
        // Use Google Geocoding API to convert city name to coordinates
        if (process.env.GOOGLE_API_KEY) {
          try {
            const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationStr)}&key=${process.env.GOOGLE_API_KEY}`;
            const geocodeRes = await fetch(geocodeUrl);
            if (geocodeRes.ok) {
              const geocodeData = await geocodeRes.json();
              if (geocodeData.results && geocodeData.results.length > 0) {
                finalLat = geocodeData.results[0].geometry.location.lat;
                finalLon = geocodeData.results[0].geometry.location.lng;
              }
            }
          } catch (e) {
            console.error('Google Geocoding error', e);
          }
        }
      } else {
        // Use ipinfo.io to get coordinates from client IP
        if (process.env.IPINFO_TOKEN) {
          try {
            const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
            const ipinfoUrl = `https://ipinfo.io/${clientIp}?token=${process.env.IPINFO_TOKEN}`;
            const ipinfoRes = await fetch(ipinfoUrl);
            if (ipinfoRes.ok) {
              const ipinfoData = await ipinfoRes.json();
              if (ipinfoData.loc) {
                const [ipLat, ipLon] = ipinfoData.loc.split(',');
                finalLat = ipLat;
                finalLon = ipLon;
              }
            }
          } catch (e) {
            console.error('ipinfo.io error', e);
          }
        }
      }
    }

    console.log('events query', { keyword: kw, segmentId, radius, unit, location, lat, lon });
    console.log('geocode result', { finalLat, finalLon });

    // Compute geoPoint geohash if lat/lon available
    let geoPoint = undefined;
    if (finalLat && finalLon) {
      try {
        const ngeohash = require('ngeohash');
        geoPoint = ngeohash.encode(parseFloat(finalLat), parseFloat(finalLon));
      } catch (e) {
        // fallback: omit geohash
      }
    }
    
    console.log('geoPoint', geoPoint);
    
    const params = new URLSearchParams();
    params.set('apikey', process.env.TM_API_KEY);
    params.set('keyword', kw);
    if (segmentId && segmentId !== 'All') params.set('segmentId', segmentId.toString());
    params.set('radius', radius.toString());
    params.set('unit', unit.toString());
    if (geoPoint) params.set('geoPoint', geoPoint);
    params.set('size', '20');

    const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params.toString()}`;
    const r = await fetch(url, { headers: tmHeaders() });
    if (!r.ok) return res.status(r.status).json({ error: 'Upstream events failed' });
    const data = await r.json();
    const events = data?._embedded?.events || [];
    // Sort ascending by local date/time
    events.sort((a, b) => {
      const ad = `${a?.dates?.start?.localDate || ''}T${a?.dates?.start?.localTime || ''}`;
      const bd = `${b?.dates?.start?.localDate || ''}T${b?.dates?.start?.localTime || ''}`;
      return ad.localeCompare(bd);
    });
    return res.json({ events: events.map(pickEventCardFields) });
  } catch (e) {
    console.error('events error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/event/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!process.env.TM_API_KEY) return res.status(500).json({ error: 'TM_API_KEY missing' });
    const params = new URLSearchParams({ apikey: process.env.TM_API_KEY });
    const url = `https://app.ticketmaster.com/discovery/v2/events/${encodeURIComponent(id)}.json?${params.toString()}`;
    const r = await fetch(url, { headers: tmHeaders() });
    if (!r.ok) return res.status(r.status).json({ error: 'Upstream event failed' });
    const data = await r.json();
    return res.json(data);
  } catch (e) {
    console.error('event error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Venue details by Ticketmaster venue id
app.get('/api/venue/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'id required' });
    if (!process.env.TM_API_KEY) return res.status(500).json({ error: 'TM_API_KEY missing' });
    const params = new URLSearchParams({ apikey: process.env.TM_API_KEY });
    const url = `https://app.ticketmaster.com/discovery/v2/venues/${encodeURIComponent(id)}.json?${params.toString()}`;
    const r = await fetch(url, { headers: tmHeaders() });
    if (!r.ok) return res.status(r.status).json({ error: 'Upstream venue failed' });
    const data = await r.json();
    return res.json(data);
  } catch (e) {
    console.error('venue error', e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------- Spotify (Artists/Albums) ----------------
let spotifyToken = { access_token: null, expires_at: 0 };
async function getSpotifyToken() {
  const now = Date.now() / 1000;
  if (spotifyToken.access_token && spotifyToken.expires_at > now + 60) return spotifyToken.access_token;
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return null;
  const body = qs.stringify({ grant_type: 'client_credentials' });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(id + ':' + secret).toString('base64'),
    },
    body,
  });
  if (!r.ok) return null;
  const data = await r.json();
  spotifyToken = { access_token: data.access_token, expires_at: now + data.expires_in };
  return spotifyToken.access_token;
}

// Search artist by name, return first match details
app.get('/api/spotify/artist', async (req, res) => {
  try {
    const name = (req.query.name || '').toString().trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const token = await getSpotifyToken();
    if (!token) return res.status(200).json({ artist: null });
    const r = await fetch('https://api.spotify.com/v1/search?type=artist&limit=1&q=' + encodeURIComponent(name), {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return res.status(200).json({ artist: null });
    const data = await r.json();
    const artist = data?.artists?.items?.[0] || null;
    res.json({ artist });
  } catch (e) {
    console.error('spotify artist error', e);
    res.status(200).json({ artist: null });
  }
});

// Get albums for an artist id
app.get('/api/spotify/artist/:id/albums', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ albums: [] });
    const token = await getSpotifyToken();
    if (!token) return res.json({ albums: [] });
    const r = await fetch(`https://api.spotify.com/v1/artists/${encodeURIComponent(id)}/albums?include_groups=album,single&limit=12`, {
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!r.ok) return res.json({ albums: [] });
    const data = await r.json();
    res.json({ albums: data.items || [] });
  } catch (e) {
    console.error('spotify albums error', e);
    res.json({ albums: [] });
  }
});

// Favorites (skeleton)
app.get('/api/favorites', async (req, res) => {
  try {
    const userId = (req.query.userId || '').toString().trim()
    if (!userId) return res.status(400).json({ error: 'userId required' })
    const coll = await getCollection('favorites')
    const items = await coll.find({ userId }).sort({ createdAt: 1 }).toArray()
    res.json(items.map(({ _id, ...rest }) => rest))
  } catch (e) {
    console.error('favorites get error', e)
    res.status(500).json({ error: 'Server error' })
  }
});
app.post('/api/favorites', async (req, res) => {
  try {
    const { userId, event } = req.body || {}
    if (!userId || !event || !event.id) return res.status(400).json({ error: 'userId and event with id required' })
    const coll = await getCollection('favorites')
    const doc = {
      userId,
      eventId: event.id,
      createdAt: new Date(),
      event,
    }
    await coll.updateOne(
      { userId, eventId: event.id },
      { $setOnInsert: doc },
      { upsert: true }
    )
    res.status(201).json({ ok: true })
  } catch (e) {
    console.error('favorites post error', e)
    res.status(500).json({ error: 'Server error' })
  }
});
app.delete('/api/favorites/:eventId', async (req, res) => {
  try {
    const userId = (req.query.userId || '').toString().trim()
    const eventId = req.params.eventId
    if (!userId || !eventId) return res.status(400).json({ error: 'userId and eventId required' })
    const coll = await getCollection('favorites')
    await coll.deleteOne({ userId, eventId })
    res.status(204).end()
  } catch (e) {
    console.error('favorites delete error', e)
    res.status(500).json({ error: 'Server error' })
  }
});

// Serve frontend build (dist folder copied inside backend/dist)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist', 'index.html'), (err) => {
    if (err) {
      res.status(404).json({ error: 'Not found' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
