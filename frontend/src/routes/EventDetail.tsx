import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getEvent, getSpotifyAlbums, getSpotifyArtist, getVenue } from '../lib/api'
import { addFavorite, fetchFavorites, getUserId, removeFavorite } from '../lib/favorites'
import { toast } from 'sonner'

// Maps Ticketmaster status codes to a badge label + color.
// (Kept intentionally simple; ensures same output formatting as before.)
function badgeForStatus(code?: string) {
  const c = (code || '').toLowerCase()
  if (c === 'onsale') return { label: 'On Sale', className: 'bg-green-600 text-white' }
  if (c === 'offsale') return { label: 'Off Sale', className: 'bg-red-600 text-white' }
  if (c === 'canceled') return { label: 'Canceled', className: 'bg-red-600 text-white' }
  if (c === 'postponed' || c === 'rescheduled') return { label: c[0].toUpperCase() + c.slice(1), className: 'bg-yellow-600 text-white' }
  return { label: code || 'Unknown', className: 'bg-gray-600 text-white' }
}

export default function EventDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const userId = useMemo(() => getUserId(), [])
  const { data: favs, refetch: refetchFavs } = useQuery({ queryKey: ['favorites', userId], queryFn: () => fetchFavorites(userId), staleTime: 10_000 })
  const { data: event, isLoading } = useQuery({ queryKey: ['event', id], queryFn: () => getEvent(id), enabled: !!id })
  const [tab, setTab] = useState<'info' | 'artists' | 'venue'>('info')

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/search')
    }
  }

  const isFav = !!favs?.some(f => f.eventId === id)
  const toggleFav = async () => {
    if (!event) return
    if (!isFav) {
      await addFavorite(userId, {
        id: event.id,
        name: event.name,
        dateLocal: event?.dates?.start?.localDate || null,
        timeLocal: event?.dates?.start?.localTime || null,
        image: (event.images && event.images[0]?.url) || null,
        venueName: event?._embedded?.venues?.[0]?.name || null,
        category: event?.classifications?.[0]?.segment?.name || null,
        url: event?.url || null,
      })
      toast.success(`${event.name} added to favorites!`, {
        description: 'You can view it in the Favorites page.',
      })
      await refetchFavs()
    } else {
      await removeFavorite(userId, id)
      toast.error(`${event.name} removed from favorites!`)
      await refetchFavs()
    }
  }

  const attractions: { name: string; segment?: string }[] = useMemo(() => {
    const arr = event?._embedded?.attractions || []
    return arr.map((a: any) => ({ name: a.name, segment: a?.classifications?.[0]?.segment?.name }))
  }, [event])
  const isMusic = (event?.classifications?.[0]?.segment?.name || '').toLowerCase() === 'music'

  if (isLoading) return <div className="p-4 animate-pulse">Loading...</div>
  if (!event) return <div className="p-4">Event not found.</div>

  const venue = event?._embedded?.venues?.[0]
  const status = badgeForStatus(event?.dates?.status?.code)
  const genres = [
    event?.classifications?.[0]?.segment?.name,
    event?.classifications?.[0]?.genre?.name,
    event?.classifications?.[0]?.subGenre?.name,
    event?.classifications?.[0]?.type?.name,
    event?.classifications?.[0]?.subType?.name,
  ].filter((x, i, a) => x && x !== 'Undefined' && a.indexOf(x) === i).join(', ')

  const seatUrl: string | null = event?.seatmap?.staticUrl || null

  const shareText = encodeURIComponent(`Check out ${event.name} on Ticketmaster!`)
  const shareUrl = encodeURIComponent(event.url || window.location.href)

  return (
  <div className="space-y-4">
      {/* Back button */}
      <button className="text-black text-sm flex items-center gap-1" onClick={goBack}>
        <span>&larr;</span> Back to Search
      </button>

      {/* Title and Buy Tickets */}
      <div className="flex items-start justify-between">
        <h2 className="text-2xl font-bold">{event.name}</h2>
        <div className="flex items-center gap-2">
          <a 
            className="rounded-xl bg-black text-white px-4 py-2 text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0" 
            href={event.url} 
            target="_blank" 
            rel="noreferrer"
          >
            Buy Tickets
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <button 
            className="rounded-xl border p-2 w-10 h-10 flex items-center justify-center hover:bg-gray-50" 
            onClick={toggleFav}
            aria-label="Toggle favorite"
          >
            {isFav ? (
              <span className="text-red-600 text-xl">❤</span>
            ) : (
              <span className="text-gray-400 text-xl">♡</span>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border border-gray-300 rounded-xl p-1 bg-gray-50 shadow-sm w-full">
        <nav className="flex gap-1 w-full">
          <button 
            className={`flex-1 py-2 text-sm font-medium rounded-lg ${tab==='info'?'bg-white text-black shadow':'bg-transparent text-gray-600'}`} 
            onClick={()=>setTab('info')}
          >
            Info
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-medium rounded-lg ${tab==='artists'?'bg-white text-black shadow':'bg-transparent text-gray-600'} ${!isMusic?'opacity-50 cursor-not-allowed':''}`} 
            disabled={!isMusic}
            onClick={()=>setTab('artists')}
          >
            Artist
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-medium rounded-lg ${tab==='venue'?'bg-white text-black shadow':'bg-transparent text-gray-600'}`} 
            onClick={()=>setTab('venue')}
          >
            Venue
          </button>
        </nav>
      </div>

      {tab === 'info' && (
        <div className="tab-body grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side - Info */}
          <div className="space-y-4">
            {event?.dates?.start?.localDate && event?.dates?.start?.localTime && (
              <div>
                <div className="text-sm font-semibold mb-1">Date</div>
                <div className="text-sm">
                  {(() => {
                    const [year, monthNum, day] = event.dates.start.localDate.split('-');
                    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                    const monthName = months[parseInt(monthNum) - 1];
                    
                    const [hour, minute] = event.dates.start.localTime.split(':');
                    const hourNum = parseInt(hour);
                    const isPM = hourNum >= 12;
                    const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
                    const timeStr = `${hour12.toString().padStart(2, '0')}:${minute} ${isPM ? 'PM' : 'AM'}`;
                    
                    return `${monthName} ${parseInt(day)}, ${year}, ${timeStr}`;
                  })()}
                </div>
              </div>
            )}

            {attractions.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-1">Artist/Team</div>
                <div className="text-sm">{attractions.map(a => a.name).join(', ')}</div>
              </div>
            )}

            {venue?.name && (
              <div>
                <div className="text-sm font-semibold mb-1">Venue</div>
                <div className="text-sm">{venue.name}</div>
              </div>
            )}

            {genres && (
              <div>
                <div className="text-sm font-semibold mb-1">Genres</div>
                <div className="text-sm">{genres}</div>
              </div>
            )}

            {Array.isArray(event.priceRanges) && event.priceRanges.length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-1">Price Ranges</div>
                <div className="text-sm">
                  {event.priceRanges.map((pr: any) => `$${pr.min} - $${pr.max} ${pr.currency || 'USD'}`).join(', ')}
                </div>
              </div>
            )}

            {event?.dates?.status?.code && (
              <div>
                <div className="text-sm font-semibold mb-1">Ticket Status</div>
                <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
              </div>
            )}

            <div>
              <div className="text-sm font-semibold mb-2">Share</div>
              <div className="flex items-center gap-2">
                <button 
                  className="w-9 h-9 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50" 
                  onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`, '_blank')}
                  aria-label="Share on Facebook"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
                  </svg>
                </button>
                <button 
                  className="w-9 h-9 rounded-full bg-white border border-gray-300 flex items-center justify-center hover:bg-gray-50" 
                  onClick={() => window.open(`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`, '_blank')}
                  aria-label="Share on Twitter"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Right side - Seatmap */}
          {/* Right side - Seatmap; keep column to preserve uniform width on desktop */}
          {seatUrl ? (
            <div className="flex flex-col">
              <div className="text-sm font-semibold mb-3">Seatmap</div>
              <img src={seatUrl} alt={event.name + ' seat map'} className="rounded border w-full" />
            </div>
          ) : (
            <div className="hidden lg:block" />
          )}
        </div>
      )}

      {tab === 'artists' && isMusic && (
        <div className="tab-body">
          <ArtistsSection names={attractions.map(a => a.name)} />
        </div>
      )}

      {tab === 'venue' && venue?.id && (
        <div className="tab-body">
          <VenueSection venueId={venue.id} />
        </div>
      )}
    </div>
  )
}

function ArtistsSection({ names }: { names: string[] }) {
  const unique = Array.from(new Set(names.filter(Boolean)))
  return (
    <div className="space-y-8">
      {unique.length === 0 && <div className="text-gray-500">No artists available.</div>}
      {unique.map((n) => (
        <ArtistCard key={n} name={n} />
      ))}
    </div>
  )
}

function ArtistCard({ name }: { name: string }) {
  const { data: artist } = useQuery({ queryKey: ['spotify-artist', name], queryFn: () => getSpotifyArtist(name) })
  const { data: albums } = useQuery({ queryKey: ['spotify-albums', artist?.id], queryFn: () => artist?.id ? getSpotifyAlbums(artist.id) : Promise.resolve([] as any[]), enabled: !!artist?.id })

  if (!artist) return (
    <div className="bg-white">
      <div className="font-medium text-lg mb-2">{name}</div>
      <div className="text-gray-500">No details found on Spotify.</div>
    </div>
  )

  const artistImage = artist.images?.[0]?.url

  return (
    <div className="bg-white space-y-4">
      {/* Artist Info Card */}
      <div className="flex items-start gap-4">
        {artistImage && (
          <img src={artistImage} alt={artist.name} className="w-32 h-32 rounded object-cover" />
        )}
        <div className="flex-1">
          <h3 className="text-xl font-bold mb-2">{artist.name}</h3>
          {/* Desktop/Tablet: inline values on one line (matches reference) */}
          <div className="hidden sm:block text-sm mb-2">
            <span className="font-semibold">Followers:</span> {artist.followers?.total?.toLocaleString?.() || '—'}
            <span className="mx-2"></span>
            <span className="font-semibold">Popularity:</span> {artist.popularity ?? '—'}%
          </div>
          {/* Mobile: labels with values beneath (stacked) */}
          <div className="text-sm mb-2 grid grid-cols-2 gap-x-6 sm:hidden">
            <div>
              <div className="font-semibold">Followers:</div>
              <div>{artist.followers?.total?.toLocaleString?.() || '—'}</div>
            </div>
            <div>
              <div className="font-semibold">Popularity:</div>
              <div>{artist.popularity ?? '—'}%</div>
            </div>
          </div>
          {artist.genres && artist.genres.length > 0 && (
            <div className="text-sm mb-3">
              <span className="font-semibold">Genres:</span> {artist.genres.join(', ')}
            </div>
          )}
          {artist.external_urls?.spotify && (
            <a 
              className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-800" 
              href={artist.external_urls.spotify} 
              target="_blank" 
              rel="noreferrer"
            >
              Open in Spotify
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Albums Section */}
      {albums && albums.length > 0 && (
        <div>
          <h4 className="text-lg font-bold mb-3">Albums</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {albums.map((al: any) => {
              const img = al.images?.[0]?.url
              const href = al.external_urls?.spotify
              return (
                <a key={al.id} href={href} target="_blank" rel="noreferrer" className="block focus:outline-none hover:opacity-80 transition">
                  {img ? (
                    <img src={img} alt={al.name} className="w-full aspect-square object-cover rounded-t mb-0" />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 rounded-t mb-0" />
                  )}
                  <div className="border border-t-0 border-gray-300 rounded-b p-3">
                    <div className="text-sm font-medium line-clamp-2 mb-1" title={al.name}>{al.name}</div>
                    <div className="text-xs text-gray-500">{al.release_date || ''}</div>
                    <div className="text-xs text-gray-500">{al.total_tracks} tracks</div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function VenueSection({ venueId }: { venueId: string }) {
  const { data: venue } = useQuery({ queryKey: ['venue', venueId], queryFn: () => getVenue(venueId), enabled: !!venueId })
  if (!venue) return <div className="text-gray-500">No venue details available.</div>

  const hasImage = !!venue.images?.[0]?.url
  const addr = [venue.address?.line1, venue.city?.name, venue.state?.stateCode].filter(Boolean).join(', ')
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || venue.name || '')}`

  return (
    <div className="space-y-6">
      {/* Venue Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-2xl font-bold mb-2">{venue?.name || '—'}</h3>
          {addr && (
            <div className="text-sm text-gray-600 flex items-center gap-1">
              <a className="text-gray-600 inline-flex items-center gap-1" href={maps} target="_blank" rel="noreferrer">
                {addr}
                <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>
        {venue?.url && (
          <a 
            className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-black text-sm inline-flex items-center gap-2 hover:bg-gray-50 shadow-md" 
            href={venue.url} 
            target="_blank" 
            rel="noreferrer"
          >
            See Events
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        )}
      </div>

      {/* Venue Content - Image Left, Details Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left: Venue Image (if available) */}
        {hasImage && (
          <div className="border border-gray-300 rounded-lg overflow-hidden h-64 lg:h-[360px] w-full">
            <img src={venue.images[0].url} alt={venue.name} className="w-full h-full object-contain" />
          </div>
        )}

        {/* Right: Venue Details; span full width on desktop if no image */}
        <div className={`min-w-0 space-y-4 ${hasImage ? '' : 'lg:col-span-2'}`}>
          {venue?.boxOfficeInfo?.openHoursDetail && (
            <div className="pb-4">
              <h4 className="font-semibold mb-2">Parking</h4>
              <p className="text-sm text-gray-700">{venue.boxOfficeInfo.openHoursDetail}</p>
            </div>
          )}
          {venue?.generalInfo?.generalRule && (
            <div className="pb-4">
              <h4 className="font-semibold mb-2">General Rule</h4>
              <p className="text-sm text-gray-700">{venue.generalInfo.generalRule}</p>
            </div>
          )}
          {venue?.generalInfo?.childRule && (
            <div className="pb-4">
              <h4 className="font-semibold mb-2">Child Rule</h4>
              <p className="text-sm text-gray-700">{venue.generalInfo.childRule}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

