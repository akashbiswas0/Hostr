"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, MapPin, Users } from "lucide-react";
import type { Entity } from "@arkiv-network/sdk";
import type { Event } from "@/lib/arkiv/types";
import { useEventImage } from "@/hooks/useEventImage";
import { resolveEventAppearance } from "@/lib/eventAppearance";

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
      <div className="aspect-square w-full bg-zinc-800" />
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
  const appearance = resolveEventAppearance(event);
  const imgUrl = useEventImage(event.imageUrl);
  const [imgError, setImgError] = useState(false);

  const rsvpCount = Number(
    entity.attributes.find((a) => a.key === "rsvpCount")?.value ?? 0,
  );
  const isFull = rsvpCount >= event.capacity;
  const isEnded = event.status === "ended";

  const organizerNameAttr = entity.attributes.find((a) => a.key === "organizerName")?.value as string | undefined;
  const organizer = organizerNameAttr || (entity.owner ? truncateAddress(entity.owner) : "Unknown");

  return (
    <Link
      href={`/events/${entity.key}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1a1224]/85 transition-all duration-200 hover:border-white/25 hover:bg-[#211730]"
    >
      {}
      <div className="relative aspect-square w-full overflow-hidden" style={{ background: appearance.theme.cardGradient }}>
        {imgUrl && !imgError && (
          <img
            src={imgUrl}
            alt={event.title}
            className="absolute inset-0 h-full w-full aspect-square object-cover opacity-80"
            onError={() => setImgError(true)}
          />
        )}
        {}
        <span
          className="absolute top-3 left-3 rounded-full border border-white/35 bg-black/35 px-2.5 py-0.5 text-xs font-semibold text-white"
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
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-white transition-colors group-hover:text-fuchsia-200">
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
            <div
              className="w-full rounded-full py-2 text-center text-xs font-semibold transition duration-200 group-hover:brightness-110"
              style={{
                backgroundColor: appearance.theme.accentColor,
                color: appearance.theme.accentTextColor,
              }}
            >
              RSVP
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
