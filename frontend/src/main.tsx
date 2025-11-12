import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'
import Search from './routes/Search'
import EventDetail from './routes/EventDetail'
import Favorites from './routes/Favorites'

const queryClient = new QueryClient()

// Detect hard reloads and remember which path was reloaded.
// This lets us clear session state only when the reload happened on /search.
try {
  const navEntries = (performance.getEntriesByType?.('navigation') || []) as PerformanceNavigationTiming[]
  const navType = navEntries[0]?.type
  const legacyType = (performance as any)?.navigation?.type // 1 === reload (legacy)
  const isReload = navType === 'reload' || legacyType === 1
  if (isReload) {
    sessionStorage.setItem('reloadedAtPath', window.location.pathname)
  }
} catch {
  // no-op
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Navigate to="/search" replace /> },
      { path: 'search', element: <Search /> },
      { path: 'event/:id', element: <EventDetail /> },
      { path: 'favorites', element: <Favorites /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
)
