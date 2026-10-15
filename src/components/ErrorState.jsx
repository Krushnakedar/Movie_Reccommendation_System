import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function ErrorState({ message, onRetry, title = 'Something went wrong', compact = false }) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center text-cinema-muted ${compact ? 'py-10' : 'py-20'}`}
    >
      <AlertTriangle size={compact ? 36 : 48} className="mb-4 text-orange-400" aria-hidden="true" />
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="mb-6 max-w-md px-4 text-sm">{message || 'An unexpected error occurred.'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-xl bg-cinema-purple px-5 py-2.5 font-medium text-white transition-all duration-200 hover:bg-cinema-purple-light"
        >
          <RefreshCw size={16} />
          Try Again
        </button>
      )}
    </div>
  );
}
