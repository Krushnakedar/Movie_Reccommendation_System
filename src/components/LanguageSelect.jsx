import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';

/**
 * Searchable language picker (combobox) populated from /api/languages.
 * `value` is a TMDB ISO 639-1 code, or '' for "Any language".
 */
export default function LanguageSelect({ languages = [], value, onChange, loading = false, error = null, onRetry, id }) {
  const autoId = useId();
  const listId = `${id || autoId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = languages.find((l) => l.code === value);
  const selectedLabel = value ? (selected ? selected.name : value.toUpperCase()) : 'Any language';

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [{ code: '', name: 'Any language', nativeName: null }, ...languages];
    return languages.filter(
      (l) => l.name.toLowerCase().includes(q) || l.nativeName?.toLowerCase().includes(q) || l.code.toLowerCase() === q
    );
  }, [languages, query]);

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);

  const choose = (option) => {
    onChange(option.code);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && options[active]) {
      e.preventDefault();
      choose(options[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  const unavailable = loading || (Boolean(error) && languages.length === 0);

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-label="Original language"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${listId}-opt-${active}` : undefined}
        autoComplete="off"
        value={open ? query : selectedLabel}
        placeholder={loading ? 'Loading languages…' : 'Search languages…'}
        disabled={unavailable}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          setQuery('');
        }}
        onKeyDown={onKeyDown}
        className="w-full cursor-pointer rounded-xl border border-cinema-border bg-cinema-card px-4 py-3 pr-10 text-white placeholder-cinema-muted transition-colors focus:border-cinema-purple focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
      <ChevronDown
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-cinema-muted"
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Languages"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-cinema-border bg-cinema-dark py-1 shadow-xl"
        >
          {options.map((opt, i) => (
            <li
              key={opt.code || 'any'}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={opt.code === value}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus so onBlur doesn't close the list before the click lands
                choose(opt);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-4 py-2 text-sm ${
                i === active ? 'bg-cinema-purple/30 text-white' : 'text-cinema-text'
              } ${opt.code === value ? 'font-semibold' : ''}`}
            >
              {opt.name}
              {opt.nativeName && <span className="ml-2 text-cinema-muted">{opt.nativeName}</span>}
            </li>
          ))}
          {options.length === 0 && (
            <li role="presentation" className="px-4 py-3 text-sm text-cinema-muted">
              No matching languages
            </li>
          )}
        </ul>
      )}

      {error && (
        <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-orange-400">
          <span>{error.message}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-lg border border-cinema-border px-2 py-1 text-cinema-text hover:border-cinema-purple/50"
            >
              <RefreshCw size={12} /> Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
