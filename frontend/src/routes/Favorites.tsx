import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addFavorite, fetchFavorites, getUserId, removeFavorite } from '../lib/favorites'
import type { EventCard } from '../lib/api'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

export default function Favorites() {
  const userId = useMemo(() => getUserId(), [])
  const { data: favs, refetch } = useQuery({ queryKey: ['favorites', userId], queryFn: () => fetchFavorites(userId), staleTime: 5_000 })

  async function onRemove(eventId: string, ev: EventCard) {
    await removeFavorite(userId, eventId)
    toast.error(`${ev.name} removed from favorites!`, {
      action: {
        label: 'Undo',
        onClick: async () => {
          await addFavorite(userId, ev)
          toast.success(`${ev.name} re-added to favorites!`, {
            description: 'You can view it in the Favorites page.',
          })
          refetch()
        },
      },
    })
    refetch()
  }

  const items = favs || []
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Favorites</h1>
      {items.length === 0 && (
        <div className="flex items-center justify-center lg:min-h-[360px]">
          <div className="text-center">
            <div className="mx-auto mb-3 w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600">❤</div>
            <div className="font-medium text-gray-900">No favorite events yet.</div>
            <div className="text-sm text-gray-500">Add events to your favorites by clicking the heart icon on any event.</div>
          </div>
        </div>
      )}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((f) => {
            const ev = f.event
            // Manual date/time formatting to match cards
            const dateStr = (() => {
              if (!ev.dateLocal) return ''
              const [year, monthNum, day] = ev.dateLocal.split('-')
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
              const monthName = months[parseInt(monthNum) - 1]
              if (!ev.timeLocal) return `${monthName} ${parseInt(day)}, ${year}`
              const [h, m] = ev.timeLocal.split(':')
              const hn = parseInt(h)
              const isPM = hn >= 12
              const h12 = hn === 0 ? 12 : hn > 12 ? hn - 12 : hn
              return `${monthName} ${parseInt(day)}, ${year} ${h12.toString().padStart(2,'0')}:${m} ${isPM ? 'PM' : 'AM'}`
            })()

            return (
              <div key={f.eventId} className="rounded-xl border hover:shadow-md transition bg-white overflow-hidden relative">
                <Link to={`/event/${f.eventId}`} className="block focus:outline-none rounded-xl">
                  <div className="relative">
                    {ev.image ? (
                      <img src={ev.image} alt={ev.name} className="w-full h-48 object-cover" />
                    ) : (
                      <div className="w-full h-48 bg-gray-100" />
                    )}
                    {ev.category && (
                      <div className="absolute left-3 top-3 bg-white px-3 py-1 rounded-full text-xs font-medium text-gray-700 shadow-sm">
                        {ev.category}
                      </div>
                    )}
                    {dateStr && (
                      <div className="absolute right-3 top-3 bg-white px-3 py-1 rounded-full text-xs text-gray-600 shadow-sm">
                        {dateStr}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-base mb-1 line-clamp-2" title={ev.name}>{ev.name}</h3>
                    <div className="text-sm text-gray-600">{ev.venueName || '—'}</div>
                  </div>
                </Link>

                <button
                  className="absolute bottom-2 right-2 bg-white rounded-xl p-1.5 border border-gray-200 hover:shadow-md transition w-8 h-8 flex items-center justify-center"
                  aria-label={`Remove ${ev.name} from favorites`}
                  onClick={async (e) => {
                    e.preventDefault();
                    await onRemove(f.eventId, ev)
                  }}
                >
                  <span className="text-red-500">❤</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
