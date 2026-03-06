"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useMemo } from "react";
import type { Hex } from "viem";
import { QRCodeSVG } from "qrcode.react";
import { SearchX, Flag, Clock, CheckCircle2, XCircle, ArrowRight, Calendar, MapPin, Users, ExternalLink, Check } from "lucide-react";
import { useEvent } from "@/hooks/useEvent";
import { useTicket } from "@/hooks/useTicket";
import { useWallet } from "@/hooks/useWallet";
import { useEventImage } from "@/hooks/useEventImage";
import { publicClient } from "@/lib/arkiv/client";
import {
  getTicketsByEvent,
  getApprovalForTicket,
  getRejectionForTicket,
  getDecisionsByEvent,
} from "@/lib/arkiv/queries/tickets";
import { getCheckinsByEvent } from "@/lib/arkiv/queries/checkins";
import { getOrganizerByWallet } from "@/lib/arkiv/queries/profiles";
import dynamic from "next/dynamic";
const EventDetailMap = dynamic(() => import("@/components/EventDetailMap"), { ssr: false })

import { ConnectButton } from "@/components/ConnectButton";
import { StatusBadge } from "@/components/StatusBadge";
import { RsvpModal } from "@/components/RsvpModal";
import { Navbar } from "@/components/Navbar";
import { ChainLink } from "@/components/ChainLink";
import { CATEGORY_STYLE, DEFAULT_CATEGORY_STYLE } from "@/lib/arkiv/categories";
import type { OrganizerProfile, Ticket } from "@/lib/arkiv/types";
import type { Entity } from "@arkiv-network/sdk";

const EXPLORER = "https://explorer.kaolin.hoodi.arkiv.network";

function toMs(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return isFinite(value) ? value * 1_000 : NaN;
  const str = String(value);
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  const t = Date.parse(str);
  return isNaN(t) ? NaN : t;
}

function formatDateFull(value: unknown) {
  const ms = toMs(value);
  if (isNaN(ms)) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(ms));
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const entityKey = params.entityKey as Hex;

  const { event, entity, isLoading, error, refetch: refetchEvent } = useEvent(entityKey);
  const { hasTicket: hasRsvp, ticket: myRsvp, entity: rsvpEntity, isLoading: rsvpLoading, refetch: refetchRsvp } =
    useTicket(entityKey);
  const { isConnected, isCorrectChain } = useWallet();

  
  const attendeeQuery = useQuery({
    queryKey: ["attendees", entityKey],
    queryFn: async () => {
      const res = await getTicketsByEvent(publicClient, entityKey);
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    enabled: !!entityKey,
    staleTime: 0,
  });

  const checkinQuery = useQuery({
    queryKey: ["checkins", entityKey],
    queryFn: async () => {
      const res = await getCheckinsByEvent(publicClient, entityKey);
      return res.success ? res.data : [];
    },
    enabled: !!entityKey,
    staleTime: 0,
  });

  const approvalsQuery = useQuery({
    queryKey: ["rsvp-approvals-public", entityKey],
    queryFn: async () => {
      const res = await getDecisionsByEvent(publicClient, entityKey, "approved");
      return res.success ? res.data : [];
    },
    enabled: !!entityKey,
    staleTime: 0,
  });

  const checkedInWallets = useMemo(() => {
    return new Set(
      (checkinQuery.data ?? []).map((e) => {
        const attr = e.attributes.find((a) => a.key === "attendeeWallet");
        return ((attr?.value as string) ?? "").toLowerCase();
      }),
    );
  }, [checkinQuery.data]);

  const approvedRsvpKeys = useMemo(() => {
    return new Set(
      (approvalsQuery.data ?? []).map((e) => {
        const attr = e.attributes.find((a) => a.key === "ticketKey");
        return ((attr?.value as string) ?? "").toLowerCase();
      }),
    );
  }, [approvalsQuery.data]);

  const confirmedAttendees = useMemo(() => {
    return (attendeeQuery.data ?? []).filter((ent) => {
      const statusAttr = ent.attributes.find((a) => a.key === "status");
      const status = (statusAttr?.value as string) ?? "confirmed";
      if (status === "confirmed") return true;
      if (status === "pending" && approvedRsvpKeys.has((ent.key as string).toLowerCase())) return true;
      return false;
    });
  }, [attendeeQuery.data, approvedRsvpKeys]);

  const organizerQuery = useQuery({
    queryKey: ["organizer-profile", entity?.owner],
    queryFn: async () => {
      if (!entity?.owner) return null;
      const res = await getOrganizerByWallet(publicClient, entity.owner as Hex);
      return res.success ? res.data : null;
    },
    enabled: !!entity?.owner,
    staleTime: 60_000,
  });
  const organizerProfile: OrganizerProfile | null = organizerQuery.data
    ? (organizerQuery.data.toJson() as OrganizerProfile)
    : null;

  const [rsvpModalOpen, setRsvpModalOpen] = useState(false);
  const heroImgUrl = useEventImage(event?.imageUrl);

  const onChainRsvpCount = Number(
    entity?.attributes.find((a) => a.key === "rsvpCount")?.value ?? 0,
  );
  const rsvpCount = attendeeQuery.isLoading
    ? onChainRsvpCount
    : confirmedAttendees.length;
  const capacity = event?.capacity ?? 0;
  const capacityPct = capacity ? Math.min(100, (rsvpCount / capacity) * 100) : 0;
  const isFull = rsvpCount >= capacity && capacity > 0;
  const isEnded = event?.status === "ended";
  const gradient = event?.category
    ? (CATEGORY_STYLE[event.category as keyof typeof CATEGORY_STYLE]?.heroGradient ??
      DEFAULT_CATEGORY_STYLE.heroGradient)
    : DEFAULT_CATEGORY_STYLE.heroGradient;
  // Is the event offline-only (has physical location, no virtual link)?
  const isOffline = !!(event?.location && !event?.virtualLink);

  const myRsvpStatus =
    (rsvpEntity?.attributes.find((a) => a.key === "status")?.value as string) ?? null;

  const { data: myApprovalEntity } = useQuery({
    queryKey: ["rsvp-approval", rsvpEntity?.key],
    queryFn: async () => {
      const res = await getApprovalForTicket(publicClient, rsvpEntity!.key as Hex);
      return res.success ? res.data : null;
    },
    enabled: myRsvpStatus === "pending" && !!rsvpEntity,
    staleTime: 30_000,
  });

  const { data: myRejectionEntity } = useQuery({
    queryKey: ["rsvp-rejection", rsvpEntity?.key],
    queryFn: async () => {
      const res = await getRejectionForTicket(publicClient, rsvpEntity!.key as Hex);
      return res.success ? res.data : null;
    },
    enabled: myRsvpStatus === "pending" && !!rsvpEntity,
    staleTime: 30_000,
  });

  const effectiveMyRsvpStatus =
    myRsvpStatus === "pending" && myApprovalEntity
      ? "confirmed"
      : myRsvpStatus === "pending" && myRejectionEntity
      ? "rejected"
      : myRsvpStatus;

  if (isLoading) return <PageSkeleton />;

  if (error || !event || !entity) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto mb-4">
            <SearchX size={24} className="text-zinc-500" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Event not found</h1>
          <p className="text-zinc-400 text-sm mb-6">{error ?? "This event could not be found."}</p>
          <button
            onClick={() => router.push("/events")}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060912] text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 0%, rgba(37,99,235,0.22), transparent 35%), radial-gradient(circle at 80% 2%, rgba(99,102,241,0.18), transparent 30%), linear-gradient(180deg, #0a1120 0%, #060912 55%)",
        }}
      />
      <Navbar />

      {/* Hero */}
      <div className="relative h-56 border-b border-white/5 flex items-end overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
        {heroImgUrl && (
          <img
            src={heroImgUrl}
            alt={event.title}
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060912] via-[#060912]/30 to-transparent" />
        <div className="relative mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6 flex items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs font-semibold text-white/80 backdrop-blur-sm">
              {event.category}
            </span>
            <StatusBadge status={event.status} />
          </div>
          <ChainLink entityKey={entity.key} label="Verified ✓" />
        </div>
      </div>

      {/* Body */}
      <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {}
          <div className="lg:col-span-2 space-y-8">
            {}
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {event.title}
              </h1>

              {}
              <div className="mt-5 flex flex-col gap-3 text-sm text-zinc-400">
                <MetaRow icon={<Calendar size={14} />}>
                  <span>{formatDateFull(event.date)}</span>
                  <ArrowRight size={12} className="text-zinc-600" />
                  <span>{formatDateFull(event.endDate)}</span>
                </MetaRow>

                <MetaRow icon={<MapPin size={14} />}>
                  {event.location}
                  {event.virtualLink && (
                    <a
                      href={event.virtualLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                    >
                      Join online <ArrowRight size={12} />
                    </a>
                  )}
                </MetaRow>

                <MetaRow icon={<Users size={14} />}>
                  <span
                    className={isFull ? "text-rose-400" : "text-zinc-400"}
                  >
                    {rsvpCount} / {capacity} attendees
                    {isFull && " · Full"}
                  </span>
                </MetaRow>
              </div>

              {}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-500">
                  <span>Capacity</span>
                  <span>{Math.round(capacityPct)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isFull ? "bg-rose-500" : "bg-violet-500"
                    }`}
                    style={{ width: `${capacityPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* About */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-white">
                About this event
              </h2>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                  {event.description}
                </p>
              </div>
            </section>

            {event.lat && event.lng ? (
              <div className="mt-6">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#e7d3e9]">
                  <MapPin size={14} /> Location
                </p>
                <EventDetailMap
                  lat={event.lat}
                  lng={event.lng}
                  title={event.title}
                  address={event.location}
                />
              </div>
            ) : event.location ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#ceb2d1]">
                <MapPin size={14} />
                <span>{event.location}</span>
              </div>
            ) : null}

            {/* Organizer */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-white">
                Organizer
              </h2>
              <Link
                href={entity.owner ? `/organizers/${entity.owner}` : "#"}
                className="group flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 transition-colors hover:border-violet-700/40 hover:bg-white/[0.07]"
              >
                {}
                {organizerProfile?.avatarUrl ? (
                  <img
                    src={organizerProfile.avatarUrl}
                    alt={organizerProfile.name}
                    className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white/10"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-700 to-pink-700 text-sm font-bold text-white ring-2 ring-white/10">
                    {organizerProfile?.name
                      ? organizerProfile.name
                          .split(" ")
                          .map((w: string) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()
                      : entity.owner
                        ? entity.owner.slice(2, 4).toUpperCase()
                        : "??"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {organizerProfile?.name ? (
                    <>
                      <p className="font-semibold text-white group-hover:text-violet-300 transition-colors">
                        {organizerProfile.name}
                      </p>
                      {organizerProfile.bio && (
                        <p className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                          {organizerProfile.bio}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="font-medium text-white group-hover:text-violet-300 transition-colors">
                      {entity.owner ? truncate(entity.owner) : "Unknown"}
                    </p>
                  )}
                  <p className="mt-1 text-xs font-mono text-zinc-600">
                    {entity.owner ? truncate(entity.owner) : "—"}
                  </p>
                </div>
                {}
                <svg className="h-4 w-4 shrink-0 text-zinc-600 group-hover:text-violet-400 transition-colors" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </section>

            {/* Attendees */}
            <section>
              <h2 className="mb-3 text-base font-semibold text-white">
                Attendees{" "}
                <span className="text-zinc-500 font-normal text-sm">
                  ({rsvpCount})
                </span>
              </h2>
              <AttendeeList
                entities={confirmedAttendees}
                isLoading={attendeeQuery.isLoading || approvalsQuery.isLoading}
                checkedInWallets={checkedInWallets}
              />
            </section>
          </div>

          {}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
                <RsvpCard
                isEnded={isEnded}
                isFull={isFull}
                isConnected={isConnected}
                isCorrectChain={isCorrectChain}
                hasRsvp={hasRsvp}
                rsvpLoading={rsvpLoading}
                myRsvp={myRsvp}
                myRsvpStatus={effectiveMyRsvpStatus}
                rsvpEntity={rsvpEntity}
                onOpen={() => setRsvpModalOpen(true)}
              />

              {}
              {hasRsvp && rsvpEntity && effectiveMyRsvpStatus !== "not-going" && (
                <div className="rounded-2xl border border-emerald-700/20 bg-emerald-950/10 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Your RSVP</p>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                      effectiveMyRsvpStatus === "pending"
                        ? "bg-violet-900/40 text-violet-300 ring-violet-700/40"
                        : effectiveMyRsvpStatus === "rejected"
                        ? "bg-rose-900/40 text-rose-300 ring-rose-700/40"
                        : effectiveMyRsvpStatus === "checked-in"
                        ? "bg-blue-900/40 text-blue-300 ring-blue-700/40"
                        : "bg-emerald-900/40 text-emerald-300 ring-emerald-700/40"
                    }`}>
                      {effectiveMyRsvpStatus === "pending"
                        ? "Awaiting approval"
                        : effectiveMyRsvpStatus === "rejected"
                        ? "Rejected"
                        : effectiveMyRsvpStatus === "checked-in"
                        ? "Checked in ✓"
                        : "Confirmed"}
                    </span>
                  </div>
                  {myRsvp?.attendeeName && (
                    <p className="text-sm text-white">{myRsvp.attendeeName}</p>
                  )}
                  {}
                  {effectiveMyRsvpStatus !== "pending" && effectiveMyRsvpStatus !== "waitlisted" && effectiveMyRsvpStatus !== "rejected" && isOffline && (
                    <div className="flex flex-col items-center gap-1.5 pt-2">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">Entry QR</p>
                      <div className="rounded-lg bg-white p-2">
                        <QRCodeSVG value={rsvpEntity.key as string} size={120} level="M" />
                      </div>
                      <p className="text-xs text-zinc-600 text-center">Show at venue</p>
                    </div>
                  )}
                  <a
                    href={`${EXPLORER}/entity/${rsvpEntity.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs font-mono text-zinc-500 hover:text-violet-400 transition-colors flex items-center gap-1"
                  >
                    {(rsvpEntity.key as string).slice(0, 14)}… <ExternalLink size={10} />
                  </a>
                  <Link
                    href="/my-rsvps"
                    className="block text-xs text-zinc-500 hover:text-white transition-colors flex items-center gap-1"
                  >
                    All my RSVPs <ArrowRight size={10} />
                  </Link>
                </div>
              )}

              {/* On-chain info */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-4 space-y-2">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                  On-chain info
                </p>
                <InfoRow label="Entity key">
                  <a
                    href={`${EXPLORER}/entity/${entity.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-violet-400 hover:text-violet-300 transition-colors truncate max-w-[140px] block"
                  >
                    {truncate(entity.key)}
                  </a>
                </InfoRow>
                {entity.createdAtBlock !== undefined && (
                  <InfoRow label="Created at block">
                    <span className="font-mono text-zinc-300 text-xs">
                      #{entity.createdAtBlock.toString()}
                    </span>
                  </InfoRow>
                )}
                <InfoRow label="Network">
                  <span className="text-zinc-300">Kaolin Testnet</span>
                </InfoRow>
              </div>
            </div>
          </div>
        </div>
      </div>
      {}
      {event && entity && (
        <RsvpModal
          open={rsvpModalOpen}
          onClose={() => setRsvpModalOpen(false)}
          entity={entity}
          event={event}
          isFull={isFull}
          onSuccess={() => {
            refetchEvent();
            refetchRsvp();
            attendeeQuery.refetch();
          }}
        />
      )}
    </div>
  );
}

interface RsvpCardProps {
  isEnded: boolean;
  isFull: boolean;
  isConnected: boolean;
  isCorrectChain: boolean;
  hasRsvp: boolean;
  rsvpLoading: boolean;
  myRsvp: Ticket | null;
  myRsvpStatus: string | null;
  rsvpEntity: Entity | null;
  onOpen: () => void;
}

function RsvpCard({
  isEnded,
  isFull,
  isConnected,
  isCorrectChain,
  hasRsvp,
  rsvpLoading,
  myRsvp,
  myRsvpStatus,
  onOpen,
}: RsvpCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-5 space-y-4">
      <h2 className="text-base font-bold text-white">RSVP</h2>

      {}
      {isEnded ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-800/50 py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 border border-white/5 mx-auto mb-2">
            <Flag size={20} className="text-zinc-500" />
          </div>
          <p className="text-sm font-medium text-zinc-400">Event has ended</p>
        </div>
      ) : rsvpLoading ? (
        <div className="h-12 rounded-xl bg-zinc-800 animate-pulse" />
      ) : !isConnected ? (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 text-center">Connect your wallet to RSVP</p>
          <div className="flex justify-center"><ConnectButton /></div>
        </div>
      ) : !isCorrectChain ? (
        <div className="text-center space-y-3">
          <p className="text-xs text-amber-400">Switch to Kaolin to RSVP</p>
          <ConnectButton />
        </div>
      ) : hasRsvp && myRsvpStatus === "pending" ? (
        <div className="rounded-xl border border-violet-700/30 bg-violet-950/20 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-900/40 mx-auto mb-2">
            <Clock size={18} className="text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-violet-300">Request pending</p>
          <p className="mt-1 text-xs text-zinc-500">Waiting for organizer approval</p>
          <Link
            href="/my-rsvps"
            className="mt-3 inline-block text-xs text-zinc-500 hover:text-white underline transition-colors"
          >
            Manage RSVPs
          </Link>
        </div>
      ) : hasRsvp && myRsvpStatus === "rejected" ? (
        <div className="rounded-xl border border-rose-700/30 bg-rose-950/20 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-900/40 mx-auto mb-2">
            <XCircle size={20} className="text-rose-400" />
          </div>
          <p className="text-sm font-semibold text-rose-300">Request rejected</p>
          <p className="mt-1 text-xs text-zinc-500">The organizer declined your request</p>
          <Link
            href="/my-rsvps"
            className="mt-3 inline-block text-xs text-zinc-500 hover:text-white underline transition-colors"
          >
            Manage RSVPs
          </Link>
        </div>
      ) : hasRsvp && myRsvpStatus === "not-going" ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-zinc-700/30 bg-zinc-800/50 py-6 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 mx-auto mb-2">
              <XCircle size={20} className="text-zinc-400" />
            </div>
            <p className="text-sm font-semibold text-zinc-300">Not attending</p>
            <p className="mt-1 text-xs text-zinc-500">You marked yourself as not going</p>
          </div>
          <button
            onClick={onOpen}
            className="w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
          >
            {isFull ? "Join Waitlist" : "Change mind? RSVP again"}
          </button>
        </div>
      ) : hasRsvp ? (
        <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 py-6 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-900/40 mx-auto mb-2">
            <CheckCircle2 size={20} className="text-emerald-400" />
          </div>
          <p className="text-sm font-semibold text-emerald-300">You&apos;re going!</p>
          {myRsvp?.attendeeName && (
            <p className="mt-1 text-xs text-zinc-500">{myRsvp.attendeeName}</p>
          )}
          <Link
            href="/my-rsvps"
            className="mt-3 inline-block text-xs text-zinc-500 hover:text-white underline transition-colors"
          >
            Manage RSVPs
          </Link>
        </div>
      ) : isFull ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-700/30 bg-amber-950/20 p-3 text-center">
            <p className="text-xs text-amber-400 font-medium">Capacity reached</p>
          </div>
          <button
            onClick={onOpen}
            className="w-full rounded-xl border border-white/10 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors"
          >
            Join Waitlist
          </button>
        </div>
      ) : (
        <button
          onClick={onOpen}
          className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition-colors shadow-lg shadow-violet-900/30"
        >
          RSVP for this Event
        </button>
      )}
    </div>
  );
}

function AttendeeList({
  entities,
  isLoading,
  checkedInWallets = new Set(),
}: {
  entities: Entity[];
  isLoading: boolean;
  checkedInWallets?: Set<string>;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-10 rounded-xl bg-white/[0.04] animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
        No attendees yet. Be the first to RSVP!
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm divide-y divide-white/5 overflow-hidden">
      {entities.map((entity) => {
        const rsvp = entity.toJson() as Ticket;
        return (
          <div
            key={entity.key}
            className="flex items-center justify-between px-4 py-3 gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              {}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-800 to-pink-800 text-xs font-bold text-white">
                {rsvp.attendeeName?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {rsvp.attendeeName || "Anonymous"}
                </p>
                {entity.owner && (
                  <p className="text-xs text-zinc-500 font-mono">
                    {truncate(entity.owner)}
                  </p>
                )}
              </div>
            </div>
            {checkedInWallets.has((entity.owner ?? "").toLowerCase()) ? (
              <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-blue-400">
                <Check size={12} /> Checked in
              </span>
            ) : (
              <span className="shrink-0 text-xs font-medium text-emerald-400">
                Confirmed
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#060912] animate-pulse">
      <div className="h-16 border-b border-white/5 bg-white/[0.04]" />
      <div className="h-56 bg-white/[0.04]" />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-10 w-3/4 rounded-xl bg-white/[0.06]" />
          <div className="h-4 w-1/2 rounded bg-white/[0.04]" />
          <div className="h-4 w-2/3 rounded bg-white/[0.04]" />
          <div className="h-32 rounded-2xl bg-white/[0.04]" />
        </div>
        <div className="h-48 rounded-2xl bg-white/[0.04]" />
      </div>
    </div>
  );
}

function MetaRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5 flex-wrap">
      <span className="mt-0.5 shrink-0 text-zinc-500">{icon}</span>
      <span className="flex items-center gap-2 flex-wrap">{children}</span>
    </div>
  );
}

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-right">{children}</span>
    </div>
  );
}
