import { Loader2, RefreshCw } from 'lucide-react';

/** "Load more" control for paged lists: shows progress, and a retry when fetching the next page failed. */
export default function LoadMoreButton({ hasMore, loading, error, onClick, page, totalPages, label = 'Load more' }) {
  if (!hasMore && !error) return null;
  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      {error && (
        <p role="alert" className="text-sm text-orange-400">
          {error.message}
        </p>
      )}
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-cinema-border px-6 py-3 font-medium text-white transition-all duration-200 hover:border-cinema-purple/60 hover:bg-white/5 disabled:cursor-wait disabled:opacity-60"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : error ? <RefreshCw size={16} /> : null}
        {loading ? 'Loading…' : error ? 'Try again' : label}
      </button>
      {totalPages > 0 && (
        <p className="text-xs text-cinema-muted">
          Page {page} of {totalPages}
        </p>
      )}
    </div>
  );
}
