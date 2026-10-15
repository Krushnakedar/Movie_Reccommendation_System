import { TrendingUp, Flame, Star, Calendar, ChevronRight } from 'lucide-react';

const icons = { trending: TrendingUp, popular: Flame, rated: Star, upcoming: Calendar };

export default function SectionHeader({ type, title, subtitle, onViewAll }) {
  const Icon = icons[type] || Star;
  return (
    <div className="flex items-end justify-between mb-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon size={20} className="text-cinema-purple-light" />
          <h2 className="text-2xl sm:text-3xl font-bold text-white">{title}</h2>
        </div>
        {subtitle && <p className="text-cinema-muted text-sm">{subtitle}</p>}
      </div>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-cinema-purple-light hover:text-white text-sm font-medium transition-colors group"
        >
          View All <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}
