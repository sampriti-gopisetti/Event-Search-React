import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { geocodeAddress, ipinfo, searchEvents, suggest, type EventCard } from '../lib/api'
import { addFavorite, fetchFavorites, getUserId, removeFavorite } from '../lib/favorites'
import { toast } from 'sonner'
import { Loader2, X, Search as SearchIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

type FormValues = {
  keyword: string
  category: 'All' | 'Music' | 'Sports' | 'Arts & Theatre' | 'Film' | 'Miscellaneous'
  distance: number
  location: string
  auto: boolean
}

const CATEGORIES: FormValues['category'][] = ['All', 'Music', 'Sports', 'Arts & Theatre', 'Film', 'Miscellaneous']

export default function Search() {
  const { register, handleSubmit, watch, setValue, reset, control, formState: { errors } } = useForm<FormValues>({
    defaultValues: { keyword: '', category: 'All', distance: 10, location: '', auto: false },
  })
  const [results, setResults] = useState<EventCard[] | null>(() => {
    const saved = sessionStorage.getItem('searchResults')
    return saved ? JSON.parse(saved) : null
  })
  const [hasSearched, setHasSearched] = useState(() => {
    const saved = sessionStorage.getItem('hasSearched')
    return saved === 'true'
  })
  const userId = useMemo(() => getUserId(), [])
  const { data: favs, refetch: refetchFavs } = useQuery({
    queryKey: ['favorites', userId],
    queryFn: () => fetchFavorites(userId),
    staleTime: 10_000,
  })
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)

  const keyword = watch('keyword')
  const auto = watch('auto')
  const distanceVal = watch('distance')
  const liveDistanceError = (() => {
    if (distanceVal === undefined || distanceVal === null) return null
    const n = Number(distanceVal)
    if (Number.isNaN(n)) return 'Distance must be a number'
    if (n < 1 || n > 100) return 'Distance must be between 1 and 100 miles'
    return null
  })()

  // Restore form state on mount
  useEffect(() => {
    // Only clear state if a HARD reload happened specifically while on /search.
    try {
      const reloadedAt = sessionStorage.getItem('reloadedAtPath')
      if (reloadedAt === '/search') {
        // Clear and remove marker so subsequent navigations don't wipe state again.
        sessionStorage.removeItem('searchResults')
        sessionStorage.removeItem('hasSearched')
        sessionStorage.removeItem('searchForm')
        sessionStorage.removeItem('reloadedAtPath')
        setResults(null)
        setHasSearched(false)
        reset({ keyword: '', category: 'All', distance: 10, location: '', auto: false })
        return
      }
    } catch { /* ignore */ }

    const savedForm = sessionStorage.getItem('searchForm')
    if (savedForm) {
      const form = JSON.parse(savedForm)
      Object.keys(form).forEach((key) => {
        setValue(key as any, form[key])
      })
    }
  }, [reset, setValue])

  // Autocomplete
  const [openSuggest, setOpenSuggest] = useState(false)
  const { data: suggestData, isFetching: suggestLoading } = useQuery({
    queryKey: ['suggest', keyword],
    queryFn: () => suggest(keyword),
    enabled: keyword.trim().length > 0,
    staleTime: 30_000,
  })
  const suggestions = useMemo(() => suggestData?.suggestions ?? (keyword ? [keyword] : []), [suggestData, keyword])
  const [openCategory, setOpenCategory] = useState(false)

  // Auto-detect location
  useEffect(() => {
    if (auto) {
      setValue('location', '')
      ipinfo().then(setCoords)
    } else {
      setCoords(null)
    }
  }, [auto, setValue])

  async function onSubmit(v: FormValues) {
    setHasSearched(true)
    setResults(null)
    let lat = coords?.lat ?? null
    let lon = coords?.lon ?? null
    if (!v.auto) {
      const g = await geocodeAddress(v.location)
      lat = g?.lat ?? null
      lon = g?.lon ?? null
    }
    if (lat == null || lon == null) {
      // simple validation feedback
      alert('Could not resolve location. Please enable Auto-detect or enter a valid address.')
      setHasSearched(false)
      return
    }
    const resp = await searchEvents({ keyword: v.keyword, segmentName: v.category, radius: v.distance, lat, lon })
    setResults(resp.events)
    
    // Save to sessionStorage
    sessionStorage.setItem('searchResults', JSON.stringify(resp.events))
    sessionStorage.setItem('hasSearched', 'true')
    sessionStorage.setItem('searchForm', JSON.stringify(v))
  }

  function onReset() {
    reset({ keyword: '', category: 'All', distance: 10, location: '', auto: false })
    setResults(null)
    setHasSearched(false)
    // Clear sessionStorage
    sessionStorage.removeItem('searchResults')
    sessionStorage.removeItem('hasSearched')
    sessionStorage.removeItem('searchForm')
  }

  return (
    <div className="space-y-6">
      {/* Horizontal search bar */}
      <form className="w-full" onSubmit={handleSubmit(onSubmit, () => setHasSearched(true))}>
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start gap-4">
          {/* Keywords */}
          <div className="relative w-full sm:w-64">
            <label className="block text-sm font-medium mb-1">Keywords <span className="text-red-600">*</span></label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="Search for events..."
              {...register('keyword', { required: true })}
              onFocus={() => setOpenSuggest(true)}
              onBlur={() => setTimeout(() => setOpenSuggest(false), 200)}
            />
            {keyword && (
              <button type="button" className="absolute right-2 top-[38px] text-gray-500" onClick={() => setValue('keyword', '')} aria-label="Clear keyword">
                <X size={16} />
              </button>
            )}
            {suggestLoading && <span className="absolute right-7 top-[38px] animate-spin"><Loader2 size={16} /></span>}
            {openSuggest && suggestions.length > 0 && (
              <ul className="absolute z-50 mt-1 w-full rounded border bg-white shadow max-h-60 overflow-auto">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <button type="button" className="block w-full text-left px-3 py-2 hover:bg-gray-100" onMouseDown={() => setValue('keyword', s)}>{s}</button>
                  </li>
                ))}
              </ul>
            )}

            {errors.keyword && <p className="text-sm text-red-600 mt-1">Please enter some keywords</p>}
          </div>

          {/* Category - custom listbox to avoid oversized native dropdown on Windows */}
          <div className="w-full sm:w-44 relative">
            <label className="block text-sm font-medium mb-1">Category <span className="text-red-600">*</span></label>
            <Controller
              name="category"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <div className="relative">
                  <button
                    type="button"
                    className="w-full rounded border px-3 py-2 text-left flex items-center justify-between"
                    aria-haspopup="listbox"
                    aria-expanded={openCategory}
                    onClick={() => setOpenCategory(v => !v)}
                  >
                    <span>{field.value}</span>
                    <svg className="w-4 h-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {/* keep a hidden select for form semantics if needed */}
                  <select className="hidden" value={field.value} onChange={field.onChange} name={field.name} />
                  {openCategory && (
                    <ul className="absolute z-50 mt-1 w-full rounded border bg-white shadow max-h-60 overflow-auto" role="listbox">
                      {CATEGORIES.map((c) => (
                        <li key={c}>
                          <button
                            type="button"
                            className={`block w-full text-left px-3 py-2 hover:bg-gray-100 ${field.value === c ? 'bg-gray-50 font-medium' : ''}`}
                            onMouseDown={() => { field.onChange(c); setOpenCategory(false) }}
                            role="option"
                            aria-selected={field.value === c}
                          >
                            {c}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            />
            {errors.category && <p className="text-sm text-red-600 mt-1">Please select a category</p>}
          </div>

          {/* Location + toggle */}
          <div className="w-full sm:flex-1 min-w-[260px]">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium">Location <span className="text-red-600">*</span></label>
              <label className="text-sm flex items-center gap-2 select-none">Auto-detect Location
                <input id="auto" type="checkbox" className="peer sr-only" {...register('auto')} />
                <span className="inline-flex h-5 w-9 items-center rounded-full bg-gray-200 peer-checked:bg-blue-600 transition-all">
                  <span className="h-4 w-4 bg-white rounded-full translate-x-0 peer-checked:translate-x-4 transition-transform ml-0.5" />
                </span>
              </label>
            </div>
            <input className="w-full rounded border px-3 py-2 disabled:opacity-50" placeholder="Enter city, district or street..." disabled={auto} {...register('location', { required: !auto })} />
            {!auto && errors.location && <p className="text-sm text-red-600 mt-1">Location is required when auto-detect is disabled</p>}
          </div>

          {/* Distance */}
          <div className="w-full sm:w-32">
            <label className="block text-sm font-medium mb-1">Distance <span className="text-red-600">*</span></label>
            <div className="relative">
              <input type="number" className="w-full rounded border pl-3 pr-14 py-2" {...register('distance', { valueAsNumber: true, required: 'Distance must be a number', min: { value: 1, message: 'Distance cannot exceed 100 miles' }, max: { value: 100, message: 'Distance cannot exceed 100 miles' } })} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 pointer-events-none">miles</div>
            </div>
            {/* Live validation message (without needing form submit) */}
            {!errors.distance && liveDistanceError && (
              <p className="text-sm text-red-600 mt-1">{liveDistanceError}</p>
            )}
            {errors.distance && <p className="text-sm text-red-600 mt-1">{errors.distance.message}</p>}
          </div>

          {/* Search button */}
          <div className="pt-2 sm:pt-6 w-full sm:w-auto">
            <button className="w-full sm:w-auto rounded-xl bg-black text-white px-4 py-2 inline-flex items-center justify-center gap-2" type="submit">
              <SearchIcon size={16} />
              <span>Search Events</span>
            </button>
          </div>
          {/* Reset is optional; keeping separate */}
          <div className="hidden">
            <button className="rounded-xl border px-4 py-2" type="button" onClick={onReset}>Reset</button>
          </div>
        </div>
      </form>

      <div>
        <h2 className="text-xl font-semibold sr-only">Results</h2>
        {!hasSearched && (
          <div className="mt-10 flex flex-col items-center text-gray-500">
            <SearchIcon size={48} className="mb-2 opacity-70" />
            <div>Enter search criteria and click the Search button to find events.</div>
          </div>
        )}
        {hasSearched && (!results || results.length === 0) && (
          <div className="mt-10 flex flex-col items-center text-gray-600">
            <SearchIcon size={48} className="mb-3 opacity-70" />
            <div className="text-base font-medium mb-1">No results found.</div>
            <div className="text-sm text-gray-500">Update the query to find events near you.</div>
          </div>
        )}
        {results && results.length > 0 && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map(ev => (
              <div key={ev.id} className="rounded-xl border hover:shadow-md transition bg-white overflow-hidden relative">
                <Link to={`/event/${ev.id}`} className="block focus:outline-none rounded-xl">
                  <div className="relative">
                    {ev.image && <img src={ev.image} alt={ev.name} className="w-full h-48 object-cover" />}
                    
                    <div className="absolute left-3 top-3 bg-white px-3 py-1 rounded-full text-xs font-medium text-gray-700 shadow-sm">
                      {ev.category || 'Event'}
                    </div>
                    
                    <div className="absolute right-3 top-3 bg-white px-3 py-1 rounded-full text-xs text-gray-600 shadow-sm">
                      {ev.dateLocal && ev.timeLocal && (() => {
                        // Manual formatting to avoid any Date object issues
                        const [year, monthNum, day] = ev.dateLocal.split('-');
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        const monthName = months[parseInt(monthNum) - 1];
                        
                        const [hour, minute] = ev.timeLocal.split(':');
                        const hourNum = parseInt(hour);
                        const isPM = hourNum >= 12;
                        const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
                        const timeStr = `${hour12.toString().padStart(2, '0')}:${minute} ${isPM ? 'PM' : 'AM'}`;
                        
                        return `${monthName} ${parseInt(day)}, ${year}, ${timeStr}`;
                      })()}
                    </div>
                  </div>
                  
                  <div className="p-3 pb-2 pr-12">
                    <h3 className="font-semibold text-base mb-1 line-clamp-2" title={ev.name}>{ev.name}</h3>
                    <div className="text-sm text-gray-600">{ev.venueName}</div>
                  </div>
                </Link>
                
                <button
                  className="absolute bottom-2 right-2 bg-white rounded-xl p-1.5 border border-gray-200 hover:shadow-md transition w-8 h-8 flex items-center justify-center"
                  aria-label="Toggle favorite"
                  onClick={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const isFav = favs?.some(f => f.eventId === ev.id)
                    if (!isFav) {
                      await addFavorite(userId, ev)
                      toast.success(`${ev.name} added to favorites!`, {
                        description: 'You can view it in the Favorites page.',
                      })
                      refetchFavs()
                    } else {
                      await removeFavorite(userId, ev.id)
                      toast.error(`${ev.name} removed from favorites!`, {
                        action: {
                          label: 'Undo',
                          onClick: async () => {
                            await addFavorite(userId, ev)
                            toast.success(`${ev.name} re-added to favorites!`)
                            refetchFavs()
                          },
                        },
                      })
                      refetchFavs()
                    }
                  }}
                >
                  {favs?.some(f => f.eventId === ev.id) ? (
                    <span className="text-red-600">❤</span>
                  ) : (
                    <span className="text-gray-400">♡</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
