import { useState } from 'react';
import { Film, Search, Bookmark, Home, Compass, Star, Menu, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Navbar({ onNavigate, currentSection }) {
  const { watchlist, searchQuery, setSearchQuery } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const navLinks = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'recommendations', label: 'Recommendations', icon: Star },
    { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-cinema-black/90 backdrop-blur-md border-b border-cinema-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button onClick={() => onNavigate('home')} className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-cinema-purple flex items-center justify-center group-hover:bg-cinema-purple-light transition-colors">
              <Film size={20} className="text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">
              <span className="text-white">Cine</span>
              <span className="text-cinema-purple-light">Match</span>
            </span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentSection === link.id
                    ? 'bg-cinema-purple/20 text-cinema-purple-light'
                    : 'text-cinema-muted hover:text-white hover:bg-white/5'
                }`}
              >
                <link.icon size={16} />
                {link.label}
                {link.id === 'watchlist' && watchlist.length > 0 && (
                  <span className="ml-1 bg-cinema-purple text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {watchlist.length > 9 ? '9+' : watchlist.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search + Mobile Menu */}
          <div className="flex items-center gap-3">
            <div className={`relative hidden sm:flex items-center transition-all duration-300 ${searchFocused ? 'w-64' : 'w-44'}`}>
              <Search size={16} className="absolute left-3 text-cinema-muted" />
              <input
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setSearchQuery(''); }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                maxLength={100}
                aria-label="Search movies"
                className="w-full bg-cinema-card border border-cinema-border rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-cinema-muted focus:outline-none focus:border-cinema-purple transition-all duration-300"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 p-1 text-cinema-muted hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-cinema-muted hover:text-white hover:bg-white/5 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="sm:hidden pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cinema-muted" />
            <input
              type="text"
              placeholder="Search movies..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setSearchQuery(''); }}
              maxLength={100}
              aria-label="Search movies"
              className="w-full bg-cinema-card border border-cinema-border rounded-lg pl-9 pr-8 py-2 text-sm text-white placeholder-cinema-muted focus:outline-none focus:border-cinema-purple transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-cinema-muted hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-cinema-border bg-cinema-dark px-4 py-3 space-y-1">
          {navLinks.map(link => (
            <button
              key={link.id}
              onClick={() => { onNavigate(link.id); setMobileMenuOpen(false); }}
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                currentSection === link.id
                  ? 'bg-cinema-purple/20 text-cinema-purple-light'
                  : 'text-cinema-muted hover:text-white hover:bg-white/5'
              }`}
            >
              <link.icon size={18} />
              {link.label}
              {link.id === 'watchlist' && watchlist.length > 0 && (
                <span className="ml-auto bg-cinema-purple text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {watchlist.length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
