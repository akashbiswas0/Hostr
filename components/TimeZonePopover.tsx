"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Globe, Search } from "lucide-react";
import {
  ALL_TIME_ZONES,
  POPULAR_TIME_ZONES,
  getTimeZoneOffsetLabel,
  toCityName,
} from "@/lib/timezone";

type TimeZonePopoverProps = {
  value: string;
  onChange: (timeZone: string) => void;
  buttonClassName?: string;
};

function prettyTimeZoneName(timeZone: string): string {
  if (timeZone === "UTC") return "Coordinated Universal Time - UTC";
  const parts = timeZone.split("/");
  if (parts.length === 1) return timeZone;
  const area = parts[0].replaceAll("_", " ");
  const city = parts.slice(1).join("/").replaceAll("_", " ");
  return `${area} - ${city}`;
}

export function TimeZonePopover({ value, onChange, buttonClassName }: TimeZonePopoverProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const popularSet = useMemo(
    () => new Set(POPULAR_TIME_ZONES.map((zone) => zone.id)),
    [],
  );

  const filteredPopular = useMemo(() => {
    if (!normalizedSearch) return POPULAR_TIME_ZONES;
    return POPULAR_TIME_ZONES.filter((zone) => {
      const offset = getTimeZoneOffsetLabel(zone.id).toLowerCase();
      return (
        zone.label.toLowerCase().includes(normalizedSearch) ||
        zone.id.toLowerCase().includes(normalizedSearch) ||
        offset.includes(normalizedSearch)
      );
    });
  }, [normalizedSearch]);

  const filteredAll = useMemo(() => {
    const source = ALL_TIME_ZONES.filter((zone) => !popularSet.has(zone));
    if (!normalizedSearch) return source;
    return source.filter((zone) => {
      const offset = getTimeZoneOffsetLabel(zone).toLowerCase();
      const pretty = prettyTimeZoneName(zone).toLowerCase();
      return (
        zone.toLowerCase().includes(normalizedSearch) ||
        pretty.includes(normalizedSearch) ||
        offset.includes(normalizedSearch)
      );
    });
  }, [normalizedSearch, popularSet]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={
          buttonClassName ??
          "w-full rounded-xl border border-white/10 bg-[#5d3763]/70 px-3 py-2 text-left"
        }
      >
        <span className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2">
            <Globe size={14} className="text-[#ddc6df]" />
            <span>
              <span className="block text-[11px] text-[#c9b2cb]">Timezone</span>
              <span className="block text-sm font-semibold text-[#f0e2f2]">{toCityName(value)}</span>
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#bba0bf]">
            {getTimeZoneOffsetLabel(value)}
            <ChevronsUpDown size={14} />
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-[min(92vw,360px)] overflow-hidden rounded-2xl border border-white/15 bg-[#2e1a31]/95 text-white shadow-2xl backdrop-blur">
          <div className="border-b border-white/10 p-2.5">
            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-2 text-sm text-zinc-300">
              <Search size={14} className="text-zinc-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search time zones"
                className="w-full bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none"
              />
            </label>
          </div>

          <div className="max-h-[340px] overflow-y-auto px-2 py-2">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-[#bfa7c1]">Popular Time Zones</p>
            <div className="space-y-1 pb-3">
              {filteredPopular.map((zone) => {
                const selected = zone.id === value;
                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => {
                      onChange(zone.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      selected ? "bg-white/10 text-white" : "text-zinc-200 hover:bg-white/8"
                    }`}
                  >
                    <span className="text-sm font-semibold leading-tight">{zone.label}</span>
                    <span className="shrink-0 text-sm text-zinc-400">{getTimeZoneOffsetLabel(zone.id)}</span>
                  </button>
                );
              })}
            </div>

            <p className="border-t border-white/10 px-2 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-[#bfa7c1]">All Time Zones</p>
            <div className="space-y-1 pb-1">
              {filteredAll.map((zone) => {
                const selected = zone === value;
                return (
                  <button
                    key={zone}
                    type="button"
                    onClick={() => {
                      onChange(zone);
                      setOpen(false);
                    }}
                    className={`flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      selected ? "bg-white/10 text-white" : "text-zinc-300 hover:bg-white/8"
                    }`}
                  >
                    <span className="text-sm leading-tight">{prettyTimeZoneName(zone)}</span>
                    <span className="shrink-0 text-sm text-zinc-500">{getTimeZoneOffsetLabel(zone)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
