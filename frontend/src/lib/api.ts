export type SuggestResponse = { suggestions: string[] }
export async function suggest(keyword: string): Promise<SuggestResponse> {
  const u = new URL('/api/suggest', window.location.origin)
  u.searchParams.set('keyword', keyword)
  const r = await fetch(u.toString())
  if (!r.ok) throw new Error('Suggest failed')
  return r.json()
}

export type SearchParams = {
  keyword: string
  segmentName?: string
  radius?: number
  unit?: 'miles' | 'km'
  lat?: number
  lon?: number
}
export type EventCard = {
  id: string
  name: string
  dateLocal: string | null
  timeLocal: string | null
  image: string | null
  venueName: string | null
  category: string | null
  url: string | null
}
export type EventsResponse = { events: EventCard[] }

export async function searchEvents(p: SearchParams): Promise<EventsResponse> {
  const u = new URL('/api/events', window.location.origin)
  u.searchParams.set('keyword', p.keyword)
  if (p.segmentName && p.segmentName !== 'All') u.searchParams.set('segmentName', p.segmentName)
  u.searchParams.set('radius', String(p.radius ?? 10))
  u.searchParams.set('unit', p.unit ?? 'miles')
  if (p.lat != null && p.lon != null) {
    u.searchParams.set('lat', String(p.lat))
    u.searchParams.set('lon', String(p.lon))
  }
  const r = await fetch(u.toString())
  if (!r.ok) throw new Error('Search failed')
  return r.json()
}

export async function ipinfo(): Promise<{ lat: number; lon: number } | null> {
  try {
    const token = import.meta.env.VITE_IPINFO_TOKEN as string | undefined
    const url = token ? `https://ipinfo.io/json?token=${encodeURIComponent(token)}` : 'https://ipinfo.io/json'
    const r = await fetch(url)
    if (!r.ok) return null
    const d = await r.json()
    const [latStr, lonStr] = String(d.loc || '').split(',')
    const lat = parseFloat(latStr), lon = parseFloat(lonStr)
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }
    return null
  } catch {
    return null
  }
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined
  if (!key) return null
  const u = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  u.searchParams.set('address', address)
  u.searchParams.set('key', key)
  const r = await fetch(u.toString())
  if (!r.ok) return null
  const d = await r.json()
  const loc = d?.results?.[0]?.geometry?.location
  if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') return { lat: loc.lat, lon: loc.lng }
  return null
}

// Event details
export async function getEvent(id: string): Promise<any> {
  const r = await fetch(`/api/event/${encodeURIComponent(id)}`)
  if (!r.ok) throw new Error('Event fetch failed')
  return r.json()
}

// Venue details by TM id
export async function getVenue(id: string): Promise<any> {
  const r = await fetch(`/api/venue/${encodeURIComponent(id)}`)
  if (!r.ok) throw new Error('Venue fetch failed')
  return r.json()
}

// Spotify helpers
export type SpotifyArtist = { 
  id: string
  name: string
  followers?: { total: number }
  popularity?: number
  external_urls?: { spotify?: string }
  images?: { url: string }[]
  genres?: string[]
}
export async function getSpotifyArtist(name: string): Promise<SpotifyArtist | null> {
  const u = new URL('/api/spotify/artist', window.location.origin)
  u.searchParams.set('name', name)
  const r = await fetch(u.toString())
  if (!r.ok) return null
  const d = await r.json()
  return d?.artist ?? null
}
export async function getSpotifyAlbums(artistId: string): Promise<any[]> {
  const r = await fetch(`/api/spotify/artist/${encodeURIComponent(artistId)}/albums`)
  if (!r.ok) return []
  const d = await r.json()
  return d?.albums ?? []
}
