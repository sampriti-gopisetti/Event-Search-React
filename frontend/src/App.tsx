import { Outlet, NavLink } from 'react-router-dom'
import { useState } from 'react'
import { Toaster } from 'sonner'
import { Menu, Search as SearchIcon, Heart } from 'lucide-react'

function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="border-b bg-white text-black sticky top-0 z-10 relative">
      <div className="site-container py-3 flex items-center justify-between">
        <NavLink to="/search" className="text-lg font-semibold text-black">Events Around</NavLink>
        <nav className="hidden md:flex gap-6 items-center">
          <NavLink to="/search" className="flex items-center gap-2 text-black">
            <SearchIcon size={18} />
            <span>Search</span>
          </NavLink>
          <NavLink to="/favorites" className="flex items-center gap-2 text-black">
            <Heart size={18} />
            <span>Favorites</span>
          </NavLink>
        </nav>
        <button
          className="md:hidden p-2 rounded hover:bg-gray-100"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <Menu />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden">
          {/* Click-away backdrop */}
          <button className="fixed inset-0 z-20 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          {/* Dropdown panel anchored to header */}
          <div className="absolute left-0 right-0 top-full z-30">
            <div className="site-container py-2">
              <div className="border rounded-xl bg-white shadow-lg p-2">
                <NavLink
                  to="/search"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 text-gray-900 ${isActive ? 'bg-gray-100 rounded-lg' : 'rounded-lg'}`
                  }
                >
                  <SearchIcon size={18} className="text-gray-700" />
                  <span>Search</span>
                </NavLink>
                <NavLink
                  to="/favorites"
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 text-gray-900 ${isActive ? 'bg-gray-100 rounded-lg' : 'rounded-lg'}`
                  }
                >
                  <Heart size={18} className="text-gray-700" />
                  <span>Favorites</span>
                </NavLink>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export default function App() {
  return (
    <div className="min-h-dvh flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 site-container py-6">
        <Outlet />
      </main>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: 'white',
            color: 'black',
            border: '1px solid #e5e7eb',
          },
        }}
      />
    </div>
  )
}
