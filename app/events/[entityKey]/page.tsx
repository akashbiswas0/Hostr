"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState, useMemo } from "react";
import type { Hex } from "viem";
import { QRCodeSVG } from "qrcode.react";
import {
  SearchX,
  Flag,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Calendar,
  MapPin,
  ExternalLink,
  Check,
} from "lucide-react";
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

const EventDetailMap = dynamic(() => import("@/components/EventDetailMap"), { ssr: false });

import { ConnectButton } from "@/components/ConnectButton";
import { StatusBadge } from "@/components/StatusBadge";
import { RsvpModal } from "@/components/RsvpModal";
import { Navbar } from "@/components/Navbar";
import { ChainLink } from "@/components/ChainLink";
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

function formatMonth(value: unknown) {
  const ms = toMs(value);
  if (isNaN(ms)) return "TBD";
  return new Intl.DateTimeFormat("en-US", { month: "short" })
    .format(new Date(ms))
    .toUpperCase();
}

function formatDayNumber(value: unknown) {
  const ms = toMs(value);
  if (isNaN(ms)) return "--";
  return new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(new Date(ms));
}

function formatTimeRange(start: unknown, end: unknown) {
  const startMs = toMs(start);
  const endMs = toMs(end);
  if (isNaN(startMs) || isNaN(endMs)) return "Time TBD";

  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${fmt.format(new Date(startMs))} - ${fmt.format(new Date(endMs))}`;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatTagLabel(value: string) {
  return value.replaceAll("_", " ");
}

function getFeaturedCity(location?: string) {
  if (!location) return "your city";
  const first = location
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)[0];
  return first || "your city";
}

function pickFirstImageValue(...values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0) ?? null;
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const entityKey = params.entityKey as Hex;

  const { event, entity, isLoading, error, refetch: refetchEvent } = useEvent(entityKey);
  const {
    hasTicket: hasRsvp,
    ticket: myRsvp,
    entity: rsvpEntity,
    isLoading: rsvpLoading,
    refetch: refetchRsvp,
  } = useTicket(entityKey);
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
  const heroImageKey = pickFirstImageValue(
    event?.posterImageUrl,
    event?.coverImageUrl,
    event?.thumbnailImageUrl,
    event?.imageUrl,
  );
  const heroImgUrl = useEventImage(heroImageKey);

  const onChainRsvpCount = Number(entity?.attributes.find((a) => a.key === "rsvpCount")?.value ?? 0);
  const rsvpCount = attendeeQuery.isLoading ? onChainRsvpCount : confirmedAttendees.length;
  const capacity = event?.capacity ?? 0;
  const isFull = rsvpCount >= capacity && capacity > 0;
  const isEnded = event?.status === "ended";
  const featuredCity = getFeaturedCity(event?.location);
  const isOffline = !!(event?.location && !event?.virtualLink);

  const myRsvpStatus = (rsvpEntity?.attributes.find((a) => a.key === "status")?.value as string) ?? null;

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
      <div className="flex min-h-screen items-center justify-center bg-[#07090f]">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-[#10141f]">
            <SearchX size={24} className="text-zinc-500" />
          </div>
          <h1 className="mb-2 text-xl font-bold text-white">Event not found</h1>
          <p className="mb-6 text-sm text-zinc-400">{error ?? "This event could not be found."}</p>
          <button
            onClick={() => router.push("/events")}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070d] text-zinc-100">
      <Backdrop />

      <div className="relative z-10">
        <Navbar active="events" />

        <main className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-4 sm:px-6 lg:pt-6">
          <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <div className="overflow-hidden rounded-2xl border border-white/20 bg-[#0d1222]/90 shadow-[0_14px_36px_rgba(0,0,0,0.4)]">
                {heroImgUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroImgUrl} alt={event.title} className="aspect-square w-full object-cover" />
                ) : (
                  <div className="flex aspect-square items-end bg-[radial-gradient(circle_at_top,rgba(86,112,255,0.35),transparent_58%),linear-gradient(160deg,#0e1330,#0a0d16)] p-4">
                    <p className="line-clamp-3 text-xl font-extrabold text-white">{event.title}</p>
                  </div>
                )}
              </div>

              <section className="rounded-2xl border border-white/12 bg-black/40 p-3 backdrop-blur-md">
                <p className="text-sm font-semibold text-zinc-200">Hosted By</p>
                <Link
                  href={entity.owner ? `/organizers/${entity.owner}` : "#"}
                  className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-2.5 transition hover:border-white/25"
                >
                  {organizerProfile?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={organizerProfile.avatarUrl}
                      alt={organizerProfile.name}
                      className="h-9 w-9 aspect-square rounded-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-bold text-indigo-200">
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
                    <p className="truncate text-sm font-semibold text-zinc-100">
                      {organizerProfile?.name || (entity.owner ? truncate(entity.owner) : "Unknown")}
                    </p>
                    <p className="truncate text-xs text-zinc-400">
                      {organizerProfile?.bio || entity.owner || "Organizer profile"}
                    </p>
                  </div>
                </Link>

                <div className="mt-3 flex flex-wrap gap-2">
                  <TagPill label={`#${formatTagLabel(event.category)}`} />
                  {event.format && <TagPill label={`#${formatTagLabel(event.format)}`} />}
                </div>
              </section>

              <section className="rounded-2xl border border-white/12 bg-black/35 p-3 backdrop-blur-md">
                <p className="text-sm font-semibold text-zinc-100">{rsvpCount} Going</p>
                <div className="mt-2 flex items-center -space-x-2">
                  {(confirmedAttendees.slice(0, 6) as Entity[]).map((attendee, index) => {
                    const ticket = attendee.toJson() as Ticket;
                    return (
                      <div
                        key={attendee.key}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0b1020] bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-[11px] font-semibold text-white"
                        style={{ zIndex: 12 - index }}
                      >
                        {(ticket.attendeeName?.[0] ?? "?").toUpperCase()}
                      </div>
                    );
                  })}
                  {rsvpCount > 6 && (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-[#0b1020] bg-zinc-800 text-[10px] font-bold text-zinc-300">
                      +{rsvpCount - 6}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-zinc-400">
                  {confirmedAttendees.length > 0
                    ? `${(confirmedAttendees[0].toJson() as Ticket).attendeeName || "Anonymous"}${
                        confirmedAttendees.length > 1 ? ` and ${confirmedAttendees.length - 1} others` : ""
                      }`
                    : "Be the first attendee"}
                </p>
              </section>
            </aside>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[11px] font-medium text-zinc-200">
                  Featured in {featuredCity}
                </span>
                <StatusBadge status={event.status} />
                <ChainLink entityKey={entity.key} />
              </div>

              <h1 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">{event.title}</h1>

              <div className="grid gap-3 sm:grid-cols-[66px_minmax(0,1fr)]">
                <div className="rounded-2xl border border-white/15 bg-black/45 p-2 text-center backdrop-blur-md">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">{formatMonth(event.date)}</p>
                  <p className="text-2xl font-extrabold leading-none text-white">{formatDayNumber(event.date)}</p>
                </div>

                <div className="rounded-2xl border border-white/15 bg-black/45 px-3 py-2.5 backdrop-blur-md">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-lg border border-white/10 bg-white/[0.06] p-1.5">
                      <Calendar size={15} className="text-zinc-200" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{formatTimeRange(event.date, event.endDate)}</p>
                      <p className="mt-0.5 text-xs text-zinc-300">{formatDateFull(event.date)}</p>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-lg border border-white/10 bg-white/[0.06] p-1.5">
                      <MapPin size={15} className="text-zinc-200" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{event.location || "Location TBD"}</p>
                      {event.virtualLink && (
                        <a
                          href={event.virtualLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-indigo-300 transition hover:text-indigo-200"
                        >
                          Join online <ArrowRight size={12} />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
                <RsvpCard
                  isEnded={isEnded}
                  isFull={isFull}
                  isConnected={isConnected}
                  isCorrectChain={isCorrectChain}
                hasRsvp={hasRsvp}
                rsvpLoading={rsvpLoading}
                myRsvp={myRsvp}
                myRsvpStatus={effectiveMyRsvpStatus}
                onOpen={() => setRsvpModalOpen(true)}
              />

                <div className="rounded-2xl border border-white/14 bg-black/40 p-3 backdrop-blur-md">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-zinc-400">On-chain info</p>
                  <div className="mt-2.5 space-y-2">
                    <InfoRow label="Entity key">
                      <a
                        href={`${EXPLORER}/entity/${entity.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[145px] truncate font-mono text-xs text-indigo-300 transition hover:text-indigo-200"
                      >
                        {truncate(entity.key)}
                      </a>
                    </InfoRow>
                    {entity.createdAtBlock !== undefined && (
                      <InfoRow label="Created at block">
                        <span className="font-mono text-xs text-zinc-200">#{entity.createdAtBlock.toString()}</span>
                      </InfoRow>
                    )}
                    <InfoRow label="Network">
                      <span className="text-xs text-zinc-200">Kaolin Testnet</span>
                    </InfoRow>
                    <InfoRow label="Capacity">
                      <span className="text-xs text-zinc-200">{capacity > 0 ? `${capacity} seats` : "Open"}</span>
                    </InfoRow>
                  </div>
                </div>
              </div>

              {hasRsvp && rsvpEntity && effectiveMyRsvpStatus !== "not-going" && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-100">Your RSVP</p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                        effectiveMyRsvpStatus === "pending"
                          ? "bg-indigo-900/50 text-indigo-200 ring-indigo-600/40"
                          : effectiveMyRsvpStatus === "rejected"
                            ? "bg-rose-900/50 text-rose-200 ring-rose-600/40"
                            : effectiveMyRsvpStatus === "checked-in"
                              ? "bg-blue-900/50 text-blue-200 ring-blue-600/40"
                              : "bg-emerald-900/50 text-emerald-200 ring-emerald-600/40"
                      }`}
                    >
                      {effectiveMyRsvpStatus === "pending"
                        ? "Awaiting approval"
                        : effectiveMyRsvpStatus === "rejected"
                          ? "Rejected"
                          : effectiveMyRsvpStatus === "checked-in"
                            ? "Checked in"
                            : "Confirmed"}
                    </span>
                  </div>

                  {myRsvp?.attendeeName && <p className="mt-1.5 text-sm text-zinc-200">{myRsvp.attendeeName}</p>}

                  {effectiveMyRsvpStatus !== "pending" &&
                    effectiveMyRsvpStatus !== "waitlisted" &&
                    effectiveMyRsvpStatus !== "rejected" &&
                    isOffline && (
                      <div className="mt-4 flex flex-col items-center gap-1.5">
                        <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-400">Entry QR</p>
                        <div className="rounded-lg bg-white p-2">
                          <QRCodeSVG value={rsvpEntity.key as string} size={112} level="M" />
                        </div>
                        <p className="text-xs text-zinc-400">Show this at check-in</p>
                      </div>
                    )}

                  <a
                    href={`${EXPLORER}/entity/${rsvpEntity.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-mono text-zinc-400 transition hover:text-indigo-300"
                  >
                    {(rsvpEntity.key as string).slice(0, 14)}… <ExternalLink size={10} />
                  </a>
                </div>
              )}

              <section>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-zinc-300">About Event</h2>
                <div className="rounded-2xl border border-white/12 bg-black/35 p-4 backdrop-blur-md">
                  <p className="whitespace-pre-wrap text-base font-semibold text-zinc-100">
                    {organizerProfile?.name || "Organizer"} Presents
                  </p>
                  <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{event.description}</p>
                </div>
              </section>

              {event.lat && event.lng ? (
                <section>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-zinc-300">
                    <MapPin size={13} /> Location
                  </h2>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-2 backdrop-blur-md">
                    <EventDetailMap lat={event.lat} lng={event.lng} title={event.title} address={event.location} />
                  </div>
                </section>
              ) : event.location ? (
                <div className="flex items-center gap-2 text-sm text-zinc-300">
                  <MapPin size={14} />
                  <span>{event.location}</span>
                </div>
              ) : null}

              <section>
                <h2 className="mb-3 text-base font-semibold text-white">
                  Attendees <span className="font-normal text-zinc-500">({rsvpCount})</span>
                </h2>
                <AttendeeList
                  entities={confirmedAttendees}
                  isLoading={attendeeQuery.isLoading || approvalsQuery.isLoading}
                  checkedInWallets={checkedInWallets}
                />
              </section>
            </section>
          </div>
        </main>
      </div>

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
    <div className="rounded-2xl border border-white/14 bg-black/45 p-4 backdrop-blur-md">
      <h2 className="text-base font-semibold text-white">Registration</h2>

      {isEnded ? (
        <div className="mt-3 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-2 text-zinc-200">
            <Flag size={16} />
            <p className="text-xl font-bold leading-tight">Registration Closed</p>
          </div>
          <p className="mt-2 text-sm text-zinc-400">This event is over. Follow the host for future updates.</p>
        </div>
      ) : rsvpLoading ? (
        <div className="mt-3 h-10 animate-pulse rounded-xl bg-white/10" />
      ) : !isConnected ? (
        <div className="mt-3 space-y-2.5">
          <p className="text-xs text-zinc-300">Connect your wallet to register.</p>
          <ConnectButton />
        </div>
      ) : !isCorrectChain ? (
        <div className="mt-3 space-y-2.5">
          <p className="text-xs text-amber-300">Switch to Kaolin Testnet to RSVP.</p>
          <ConnectButton />
        </div>
      ) : hasRsvp && myRsvpStatus === "pending" ? (
        <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
          <div className="flex items-center gap-2 text-indigo-200">
            <Clock size={16} />
            <p className="text-sm font-semibold">Status: Pending</p>
          </div>
          <p className="mt-0.5 text-xs text-zinc-300">Waiting for organizer approval.</p>
        </div>
      ) : hasRsvp && myRsvpStatus === "waitlisted" ? (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="flex items-center gap-2 text-amber-200">
            <Clock size={16} />
            <p className="text-sm font-semibold">Status: Waitlisted</p>
          </div>
          <p className="mt-0.5 text-xs text-zinc-300">You are in line and will be promoted if a seat opens.</p>
        </div>
      ) : hasRsvp && myRsvpStatus === "rejected" ? (
        <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
          <div className="flex items-center gap-2 text-rose-200">
            <XCircle size={16} />
            <p className="text-sm font-semibold">Status: Rejected</p>
          </div>
          <p className="mt-0.5 text-xs text-zinc-300">The organizer declined your RSVP request.</p>
        </div>
      ) : hasRsvp && myRsvpStatus === "not-going" ? (
        <div className="mt-3 space-y-2.5">
          <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 p-3">
            <div className="flex items-center gap-2 text-zinc-300">
              <XCircle size={16} />
              <p className="text-sm font-semibold">Not attending</p>
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">You marked yourself as not going.</p>
          </div>
          <button
            onClick={onOpen}
            className="w-full rounded-xl border border-white/20 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {isFull ? "Join Waitlist" : "RSVP Again"}
          </button>
        </div>
      ) : hasRsvp && myRsvpStatus === "checked-in" ? (
        <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3">
          <div className="flex items-center gap-2 text-blue-200">
            <CheckCircle2 size={16} />
            <p className="text-sm font-semibold">Status: Checked in</p>
          </div>
          {myRsvp?.attendeeName && <p className="mt-0.5 text-xs text-zinc-300">{myRsvp.attendeeName}</p>}
        </div>
      ) : hasRsvp ? (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="flex items-center gap-2 text-emerald-200">
            <CheckCircle2 size={16} />
            <p className="text-sm font-semibold">Status: Confirmed</p>
          </div>
          {myRsvp?.attendeeName && <p className="mt-0.5 text-xs text-zinc-300">{myRsvp.attendeeName}</p>}
        </div>
      ) : isFull ? (
        <div className="mt-3 space-y-2.5">
          <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-2.5 text-center text-xs font-medium text-amber-200">
            Capacity reached
          </div>
          <button
            onClick={onOpen}
            className="w-full rounded-xl border border-white/20 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Join Waitlist
          </button>
        </div>
      ) : (
        <button
          onClick={onOpen}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-500 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(59,130,246,0.35)] transition hover:brightness-110"
        >
          Get Ticket
        </button>
      )}

      
    </div>
  );
}

function capacityPercentFromCard(isFull: boolean, hasRsvp: boolean) {
  if (isFull) return 100;
  return hasRsvp ? 82 : 46;
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
          <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.06]" />
        ))}
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-white/15 py-8 text-center text-sm text-zinc-500">
        No attendees yet. Be the first to RSVP.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30 backdrop-blur-md">
      {entities.map((entity, idx) => {
        const rsvp = entity.toJson() as Ticket;
        return (
          <div
            key={entity.key}
            className={`flex items-center justify-between gap-4 px-4 py-3 ${
              idx < entities.length - 1 ? "border-b border-white/6" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-600 text-xs font-bold text-white">
                {rsvp.attendeeName?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">{rsvp.attendeeName || "Anonymous"}</p>
                {entity.owner && <p className="font-mono text-xs text-zinc-500">{truncate(entity.owner)}</p>}
              </div>
            </div>
            {checkedInWallets.has((entity.owner ?? "").toLowerCase()) ? (
              <span className="shrink-0 text-xs font-medium text-sky-300">Checked in</span>
            ) : (
              <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-emerald-300">
                <Check size={12} /> Confirmed
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
    <div className="min-h-screen animate-pulse bg-[#060910]">
      <div className="h-16 border-b border-white/10 bg-white/[0.03]" />
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-4 py-10 lg:grid-cols-[320px_minmax(0,1fr)] sm:px-6">
        <div className="space-y-4">
          <div className="aspect-[4/5] rounded-3xl bg-white/[0.05]" />
          <div className="h-40 rounded-2xl bg-white/[0.05]" />
          <div className="h-28 rounded-2xl bg-white/[0.05]" />
        </div>
        <div className="space-y-4">
          <div className="h-7 w-40 rounded-lg bg-white/[0.05]" />
          <div className="h-14 w-2/3 rounded-lg bg-white/[0.05]" />
          <div className="h-28 rounded-2xl bg-white/[0.05]" />
          <div className="h-44 rounded-2xl bg-white/[0.05]" />
          <div className="h-64 rounded-2xl bg-white/[0.05]" />
        </div>
      </div>
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
      <span className="text-right text-xs">{children}</span>
    </div>
  );
}

function TagPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-300">
      {label}
    </span>
  );
}

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(67,97,238,0.24),transparent_44%),radial-gradient(circle_at_88%_18%,rgba(224,120,41,0.14),transparent_40%),linear-gradient(180deg,#070a10_0%,#05070d_55%,#04050a_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:repeating-conic-gradient(from_200deg_at_50%_50%,rgba(124,58,237,0.18)_0deg,transparent_7deg,transparent_18deg)]" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(rgba(255,255,255,0.18)_0.55px,transparent_0.55px)] [background-size:3px_3px]" />
    </div>
  );
}
