"use client";

import { EVENT_CATEGORIES } from "@/lib/arkiv/categories";
export { type Category } from "@/lib/arkiv/categories";

export const CATEGORIES = EVENT_CATEGORIES;

export interface FilterState {
  keyword: string;
  category: string;
  location: string;
  dateFrom: string;
  dateTo: string;
  status: "upcoming" | "live" | "";
  format: "" | "in_person" | "online" | "hybrid";
  approvalMode: "" | "auto" | "manual";
  availability: "" | "open";
  hasImage: "" | "with-image";
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
  format: "",
  approvalMode: "",
  availability: "",
  hasImage: "",
};

const inputCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors";

const selectCls =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/30 transition-colors appearance-none cursor-pointer";

export function FilterBar({ filters, onChange, onClear, showKeyword = true }: FilterBarProps) {
  const hasFilters =
    filters.keyword !== "" ||
    filters.category !== "" ||
    filters.location !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.status !== "" ||
    filters.format !== "" ||
    filters.approvalMode !== "" ||
    filters.availability !== "" ||
    filters.hasImage !== "";

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...filters, [key]: value });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-transparent p-4">
      {showKeyword && (
        <div className="mb-3">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by title, description, venue"
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
        <FilterSelect
          label="Category"
          value={filters.category}
          onChange={(value) => update("category", value)}
          options={[{ label: "All categories", value: "" }, ...CATEGORIES.map((c) => ({ label: c, value: c }))]}
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">Location</label>
          <input
            type="text"
            placeholder="City or venue"
            value={filters.location}
            onChange={(e) => update("location", e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">From date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-500">To date</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
            className={inputCls}
          />
        </div>

        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(value) => update("status", value as FilterState["status"])}
          options={[
            { label: "Upcoming + full", value: "" },
            { label: "Upcoming", value: "upcoming" },
            { label: "Live (full)", value: "live" },
          ]}
        />

        <FilterSelect
          label="Format"
          value={filters.format}
          onChange={(value) => update("format", value as FilterState["format"])}
          options={[
            { label: "Any format", value: "" },
            { label: "In person", value: "in_person" },
            { label: "Online", value: "online" },
            { label: "Hybrid", value: "hybrid" },
          ]}
        />

        <FilterSelect
          label="Approval"
          value={filters.approvalMode}
          onChange={(value) => update("approvalMode", value as FilterState["approvalMode"])}
          options={[
            { label: "Any approval", value: "" },
            { label: "Auto approve", value: "auto" },
            { label: "Manual approval", value: "manual" },
          ]}
        />

        <FilterSelect
          label="Availability"
          value={filters.availability}
          onChange={(value) => update("availability", value as FilterState["availability"])}
          options={[
            { label: "All availability", value: "" },
            { label: "Has seats", value: "open" },
          ]}
        />

        <FilterSelect
          label="Media"
          value={filters.hasImage}
          onChange={(value) => update("hasImage", value as FilterState["hasImage"])}
          options={[
            { label: "Any", value: "" },
            { label: "With image", value: "with-image" },
          ]}
        />

        <div className="flex items-end">
          {hasFilters && (
            <button
              onClick={onClear}
              className="h-10 w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-500 hover:border-white/20 hover:text-white transition-colors"
              title="Clear all filters"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {hasFilters && (
        <div className="mt-3 flex flex-wrap gap-2">
          {filters.keyword && <FilterPill label={`"${filters.keyword}"`} onRemove={() => update("keyword", "")} />}
          {filters.category && <FilterPill label={filters.category} onRemove={() => update("category", "")} />}
          {filters.location && <FilterPill label={filters.location} onRemove={() => update("location", "")} />}
          {filters.dateFrom && <FilterPill label={`From ${filters.dateFrom}`} onRemove={() => update("dateFrom", "")} />}
          {filters.dateTo && <FilterPill label={`To ${filters.dateTo}`} onRemove={() => update("dateTo", "")} />}
          {filters.status && <FilterPill label={filters.status} onRemove={() => update("status", "")} />}
          {filters.format && <FilterPill label={filters.format} onRemove={() => update("format", "")} />}
          {filters.approvalMode && <FilterPill label={filters.approvalMode} onRemove={() => update("approvalMode", "")} />}
          {filters.availability && <FilterPill label={filters.availability} onRemove={() => update("availability", "")} />}
          {filters.hasImage && <FilterPill label={filters.hasImage} onRemove={() => update("hasImage", "")} />}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="relative">
      <label className="mb-1 block text-xs font-medium text-zinc-500">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectCls}
        >
          {options.map((option) => (
            <option key={option.label + option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronIcon />
      </div>
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
      <svg className="h-3.5 w-3.5 text-zinc-500" viewBox="0 0 12 12" fill="none">
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
