import type { EventCard } from './api'

export type FavoriteDoc = { userId: string; eventId: string; createdAt: string; event: EventCard }

export function getUserId(): string {
  const key = 'eventsAround:userId'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export async function fetchFavorites(userId: string): Promise<FavoriteDoc[]> {
  const u = new URL('/api/favorites', window.location.origin)
  u.searchParams.set('userId', userId)
  const r = await fetch(u)
  if (!r.ok) throw new Error('Fetch favorites failed')
  return r.json()
}

export async function addFavorite(userId: string, event: EventCard): Promise<void> {
  const r = await fetch('/api/favorites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, event }),
  })
  if (!r.ok) throw new Error('Add favorite failed')
}

export async function removeFavorite(userId: string, eventId: string): Promise<void> {
  const u = new URL(`/api/favorites/${encodeURIComponent(eventId)}`, window.location.origin)
  u.searchParams.set('userId', userId)
  const r = await fetch(u, { method: 'DELETE' })
  if (!r.ok && r.status !== 204) throw new Error('Remove favorite failed')
}
