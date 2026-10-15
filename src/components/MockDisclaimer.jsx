import { AlertCircle } from 'lucide-react';

export default function MockDisclaimer() {
  return (
    <div className="flex items-center gap-3 bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 text-amber-400 text-sm mb-6">
      <AlertCircle size={16} className="flex-shrink-0" />
      <span>
        <strong>Development Mode:</strong> All movie data shown is temporary mock data for layout and design purposes only.
        Real API integration (e.g., TMDB) will be implemented in the next phase.
      </span>
    </div>
  );
}
