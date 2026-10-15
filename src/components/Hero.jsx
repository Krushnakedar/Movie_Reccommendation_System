import { Sparkles, ChevronDown } from 'lucide-react';

export default function Hero({ onDiscover }) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-cinema-black via-cinema-dark to-cinema-purple-glow/30" />
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cinema-purple/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-cinema-purple-light/5 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
      </div>

      {/* Film strip decoration */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cinema-purple to-transparent opacity-50" />

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-cinema-purple/20 border border-cinema-purple/30 rounded-full px-4 py-2 mb-8 text-sm text-cinema-purple-light">
          <Sparkles size={14} />
          <span>AI-Powered Movie Recommendations</span>
        </div>

        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-tight">
          <span className="text-white">Find Your Next</span>
          <br />
          <span className="bg-gradient-to-r from-cinema-purple-light to-purple-300 bg-clip-text text-transparent">
            Favourite Movie
          </span>
        </h1>

        <p className="text-cinema-muted text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          Discover films tailored to your taste. Browse trending titles, explore by mood,
          and let our recommendation engine find your next cinematic obsession.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => onDiscover('discover')}
            className="group px-8 py-4 bg-cinema-purple hover:bg-cinema-purple-light rounded-xl font-semibold text-white text-lg transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cinema-purple/30 focus:outline-none focus:ring-2 focus:ring-cinema-purple"
          >
            <span className="flex items-center justify-center gap-2">
              <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
              Discover Movies
            </span>
          </button>
          <button
            onClick={() => onDiscover('recommendations')}
            className="px-8 py-4 border border-cinema-border hover:border-cinema-purple/50 rounded-xl font-semibold text-cinema-muted hover:text-white text-lg transition-all duration-300 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-cinema-purple"
          >
            Get Recommendations
          </button>
        </div>

        <div className="mt-16 flex items-center justify-center gap-8 text-cinema-muted text-sm">
          {[['10,000+', 'Movies'], ['AI-Powered', 'Recommendations'], ['12+', 'Genres']].map(([val, label]) => (
            <div key={label} className="text-center">
              <div className="text-white font-bold text-xl">{val}</div>
              <div className="text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-cinema-muted animate-bounce">
        <ChevronDown size={28} />
      </div>
    </section>
  );
}
