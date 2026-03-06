import Link from "next/link";
import { Calendar, MapPin, Users } from "lucide-react";
import type { Entity } from "@arkiv-network/sdk";
import type { Event } from "@/lib/arkiv/types";
import { StatusBadge } from "./StatusBadge";

const CATEGORY_STYLE: Record<string, { gradient: string; badge: string }> = {
  DeFi: {
    gradient: "from-purple-400 to-violet-600",
    badge: "bg-white/90 text-purple-700",
  },
  NFT: {
    gradient: "from-pink-400 to-rose-500",
    badge: "bg-white/90 text-pink-700",
  },
  Gaming: {
    gradient: "from-cyan-400 to-blue-500",
    badge: "bg-white/90 text-cyan-700",
  },
  IRL: {
    gradient: "from-amber-400 to-orange-500",
    badge: "bg-white/90 text-amber-700",
  },
  Virtual: {
    gradient: "from-emerald-400 to-teal-500",
    badge: "bg-white/90 text-emerald-700",
  },
  DAO: {
    gradient: "from-indigo-400 to-purple-500",
    badge: "bg-white/90 text-indigo-700",
  },
};

function getCategoryStyle(category: string) {
  return (
    CATEGORY_STYLE[category] ?? {
      gradient: "from-gray-400 to-gray-500",
      badge: "bg-white/90 text-gray-700",
    }
  );
}

function toMs(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return isFinite(value) ? value * 1_000 : NaN;
  const str = String(value);
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  const t = Date.parse(str);
  return isNaN(t) ? NaN : t;
}

function formatDate(value: unknown) {
  const ms = toMs(value);
  if (isNaN(ms)) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
}

function formatDateShort(value: unknown) {
  const ms = toMs(value);
  if (isNaN(ms)) return "TBD";
  const d = new Date(ms);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(d);
}

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export interface EventCardProps {
  entity: Entity;
  event: Event;
  skeleton?: false;
}

export interface EventCardSkeletonProps {
  skeleton: true;
}

export function EventCardSkeleton() {
  return (
    <div className="rounded-2xl bg-zinc-900 border border-white/5 overflow-hidden animate-pulse">
      <div className="h-28 bg-zinc-800" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 rounded-lg bg-zinc-800" />
        <div className="h-3 w-1/2 rounded-lg bg-zinc-800" />
        <div className="h-3 w-2/3 rounded-lg bg-zinc-800" />
        <div className="h-9 rounded-full bg-zinc-800 mt-2" />
      </div>
    </div>
  );
}

export function EventCard({ entity, event }: EventCardProps) {
  const { gradient, badge } = getCategoryStyle(event.category);

  const rsvpCount = Number(
    entity.attributes.find((a) => a.key === "rsvpCount")?.value ?? 0,
  );
  const capacityPct = Math.min(
    100,
    Math.round((rsvpCount / Math.max(1, event.capacity)) * 100),
  );
  const isFull = rsvpCount >= event.capacity;
  const isEnded = event.status === "ended";

  const organizerNameAttr = entity.attributes.find((a) => a.key === "organizerName")?.value as string | undefined;
  const organizer = organizerNameAttr || (entity.owner ? truncateAddress(entity.owner) : "Unknown");

  return (
    <Link
      href={`/events/${entity.key}`}
      className="group flex flex-col rounded-2xl bg-zinc-900 border border-white/5 overflow-hidden hover:border-white/10 hover:bg-zinc-800/80 transition-all duration-200 cursor-pointer"
    >
      {}
      <div className={`relative h-28 bg-gradient-to-br ${gradient}`}>
        {}
        <span
          className={`absolute top-3 left-3 text-xs font-semibold rounded-full px-2.5 py-0.5 ${badge}`}
        >
          {event.category}
        </span>
        {}
        <span className="absolute top-3 right-3 text-xs font-semibold rounded-full px-2.5 py-0.5 bg-white/90 text-gray-700">
          {formatDateShort(event.date)}
        </span>
      </div>

      {}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {}
        <h3 className="font-semibold text-white text-base leading-snug line-clamp-2 group-hover:text-violet-300 transition-colors">
          {event.title}
        </h3>

        {}
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-[10px] font-bold text-white shrink-0">
            {organizer.slice(0, 2).toUpperCase()}
          </span>
          <span className={`text-xs truncate ${organizerNameAttr ? "text-zinc-300 font-medium" : "text-zinc-500 font-mono"}`}>
            {organizer}
          </span>
        </div>

        {}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Calendar size={12} className="shrink-0" />
          <span>{formatDate(event.date)}</span>
        </div>

        {}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 truncate">
          <MapPin size={12} className="shrink-0" />
          <span className="truncate">{event.location || "Online"}</span>
        </div>

        {}
        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Users size={12} className="shrink-0" />
          <span>
            {rsvpCount} / {event.capacity} attending
          </span>
          {isFull && (
            <span className="rounded-full bg-rose-900/30 text-rose-400 text-[10px] font-semibold px-2 py-0.5">
              Full
            </span>
          )}
        </div>

        {}
        <div className="mt-auto pt-2">
          {isEnded ? (
            <div className="w-full rounded-full bg-zinc-800 py-2 text-center text-xs font-semibold text-zinc-500">
              Ended
            </div>
          ) : isFull ? (
            <div className="w-full rounded-full bg-zinc-800 py-2 text-center text-xs font-semibold text-zinc-400">
              Join Waitlist
            </div>
          ) : (
            <div className="w-full rounded-full bg-violet-600 py-2 text-center text-xs font-semibold text-white group-hover:bg-violet-500 transition-colors">
              RSVP
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
