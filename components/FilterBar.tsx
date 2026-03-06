"use client";

export const CATEGORIES = [
  "DeFi",
  "NFT",
  "Gaming",
  "IRL",
  "Virtual",
  "Infrastructure",
  "DAO",
  "Education",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface FilterState {
  keyword: string;
  category: string;
  location: string;
  dateFrom: string;
  dateTo: string;
  status: "upcoming" | "live" | "";
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (next: FilterState) => void;
  onClear: () => void;

  showKeyword?: boolean;
}

export const DEFAULT_FILTERS: FilterState = {
  keyword: "",
  category: "",
  location: "",
  dateFrom: "",
  dateTo: "",
  status: "",
};

const inputCls =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors";

const selectCls =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors appearance-none cursor-pointer";

export function FilterBar({ filters, onChange, onClear, showKeyword = true }: FilterBarProps) {
  const hasFilters =
    filters.keyword !== "" ||
    filters.category !== "" ||
    filters.location !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.status !== "";

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900 p-4">
      {}
      {showKeyword && (
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by title or description…"
              value={filters.keyword}
              onChange={(e) => update("keyword", e.target.value)}
              className={`${inputCls} pl-9`}
            />
            {filters.keyword && (
              <button
                onClick={() => update("keyword", "")}
                className="absolute inset-y-0 right-2.5 flex items-center text-zinc-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none">
                  <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {}
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Category
          </label>
          <div className="relative">
            <select
              value={filters.category}
              onChange={(e) => update("category", e.target.value)}
              className={selectCls}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronIcon />
          </div>
        </div>

        {}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Location
          </label>
          <input
            type="text"
            placeholder="City or venue"
            value={filters.location}
            onChange={(e) => update("location", e.target.value)}
            className={inputCls}
          />
        </div>

        {}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            From date
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
            className={inputCls}
          />
        </div>

        {}
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            To date
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
            className={inputCls}
          />
        </div>

        {}
        <div className="flex flex-col gap-1">
          <label className="mb-1 block text-xs font-medium text-zinc-500">
            Status
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <select
                value={filters.status}
                onChange={(e) =>
                  update("status", e.target.value as FilterState["status"])
                }
                className={selectCls}
              >
                <option value="">Upcoming + Full</option>
                <option value="upcoming">Upcoming (has seats)</option>
                <option value="live">Full (waitlist only)</option>
              </select>
              <ChevronIcon />
            </div>
            {hasFilters && (
              <button
                onClick={onClear}
                className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500 hover:border-white/20 hover:text-white transition-colors"
                title="Clear all filters"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {}
      {hasFilters && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.keyword && (
            <FilterPill
              label={`"${filters.keyword}"`}
              onRemove={() => update("keyword", "")}
            />
          )}
          {filters.category && (
            <FilterPill
              label={filters.category}
              onRemove={() => update("category", "")}
            />
          )}
          {filters.location && (
            <FilterPill
              label={filters.location}
              onRemove={() => update("location", "")}
            />
          )}
          {filters.dateFrom && (
            <FilterPill
              label={`From ${filters.dateFrom}`}
              onRemove={() => update("dateFrom", "")}
            />
          )}
          {filters.dateTo && (
            <FilterPill
              label={`To ${filters.dateTo}`}
              onRemove={() => update("dateTo", "")}
            />
          )}
          {filters.status && (
            <FilterPill
              label={filters.status.charAt(0).toUpperCase() + filters.status.slice(1)}
              onRemove={() => update("status", "")}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FilterPill({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-900/30 px-2.5 py-0.5 text-xs font-medium text-violet-300 ring-1 ring-violet-700/40">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-white transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <svg
          className="h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 2l8 8M10 2l-8 8"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}

function ChevronIcon() {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
      <svg
        className="h-3.5 w-3.5 text-zinc-500"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path
          d="M2.5 4.5L6 8l3.5-3.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
