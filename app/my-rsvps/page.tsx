"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import type { Hex } from "viem";
import type { Entity } from "@arkiv-network/sdk";
import { QRCodeSVG } from "qrcode.react";
import { Lock, AlertTriangle, Calendar, MapPin, Ticket, BanIcon } from "lucide-react";
import { useMyTickets } from "@/hooks/useTicket";
import { useEvent } from "@/hooks/useEvent";
import { useWallet } from "@/hooks/useWallet";
import { ConfirmModal } from "@/components/ConfirmModal";
import { publicClient } from "@/lib/arkiv/client";
import { updateTicketStatus, promoteFirstWaitlistedTicket } from "@/lib/arkiv/entities/ticket";
import { getTicketsByEvent, getApprovalForTicket, getRejectionForTicket } from "@/lib/arkiv/queries/tickets";
import { friendlyError } from "@/lib/arkiv/errors";
import { ConnectButton } from "@/components/ConnectButton";
import { Navbar } from "@/components/Navbar";
import { AddressBadge } from "@/components/AddressBadge";
import { ChainLink } from "@/components/ChainLink";
import type { Ticket as TicketData } from "@/lib/arkiv/types";
import type { WalletArkivClient } from "@arkiv-network/sdk";
import type { Account, Chain, Transport } from "viem";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
  }).format(new Date(ms));
}

const STATUS_STYLE: Record<string, { dot: string; label: string; text: string }> = {
  pending: { dot: "bg-violet-400 animate-pulse", label: "Pending approval", text: "text-violet-300" },
  confirmed: { dot: "bg-emerald-400", label: "Confirmed", text: "text-emerald-300" },
  waitlisted: { dot: "bg-amber-400", label: "Waitlisted", text: "text-amber-300" },
  "checked-in": { dot: "bg-blue-400 animate-pulse", label: "Checked in", text: "text-blue-300" },
  rejected: { dot: "bg-rose-500", label: "Rejected by organizer", text: "text-rose-400" },
  "not-going": { dot: "bg-zinc-500", label: "Not going", text: "text-zinc-400" },
};

export default function MyRsvpsPage() {
  const { address, isConnected, isCorrectChain, walletClient } = useWallet();
  const { ticketEntities, isLoading, error, refetch } = useMyTickets();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar active="my-rsvps" />

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        {}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">My RSVPs</h1>
          {address && (
            <div className="mt-1">
              <AddressBadge address={address} />
            </div>
          )}
        </div>

        {}
        {!isConnected ? (
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-white/10 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10">
              <Lock size={24} className="text-violet-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">
                Connect your wallet
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Connect to see your RSVPs
              </p>
            </div>
            <ConnectButton />
          </div>
        ) : !isCorrectChain ? (
          <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-amber-700/30 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-amber-700/30">
              <AlertTriangle size={24} className="text-amber-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-white">Wrong network</p>
              <p className="mt-1 text-sm text-amber-400">
                Switch to Kaolin to view your RSVPs
              </p>
            </div>
            <ConnectButton />
          </div>
        ) : isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div className="rounded-2xl border border-red-800/30 bg-red-950/20 p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => refetch()}
              className="mt-3 text-xs text-zinc-400 hover:text-white underline"
            >
              Retry
            </button>
          </div>
        ) : ticketEntities.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">
              {ticketEntities.length} ticket{ticketEntities.length !== 1 ? "s" : ""}
            </p>
            {ticketEntities.map((rsvpEntity) => (
              <RsvpRow
                key={rsvpEntity.key}
                rsvpEntity={rsvpEntity}
                walletClient={walletClient}
                onCancelled={refetch}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function RsvpRow({
  rsvpEntity,
  walletClient,
  onCancelled,
}: {
  rsvpEntity: Entity;
  walletClient: WalletArkivClient<Transport, Chain, Account> | null;
  onCancelled: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rsvp = rsvpEntity.toJson() as TicketData;
  const eventKey = rsvpEntity.attributes.find((a) => a.key === "eventKey")
    ?.value as Hex | undefined;
  const rsvpStatus =
    (rsvpEntity.attributes.find((a) => a.key === "status")?.value as string) ??
    "confirmed";
  const isCheckedIn = rsvpStatus === "checked-in";

  const { data: approvalEntity } = useQuery({
    queryKey: ["rsvp-approval", rsvpEntity.key],
    queryFn: async () => {
      const res = await getApprovalForTicket(publicClient, rsvpEntity.key as Hex);
      return res.success ? res.data : null;
    },
    enabled: rsvpStatus === "pending",
    staleTime: 30_000,
  });

  const { data: rejectionEntity } = useQuery({
    queryKey: ["rsvp-rejection", rsvpEntity.key],
    queryFn: async () => {
      const res = await getRejectionForTicket(publicClient, rsvpEntity.key as Hex);
      return res.success ? res.data : null;
    },
    enabled: rsvpStatus === "pending",
    staleTime: 30_000,
  });

  const effectiveStatus = isCheckedIn
    ? "checked-in"
    : rsvpStatus === "not-going"
    ? "not-going"
    : rsvpStatus === "pending" && approvalEntity
    ? "confirmed"
    : rsvpStatus === "pending" && rejectionEntity
    ? "rejected"
    : rsvpStatus;

  const { event, isLoading: eventLoading } = useEvent(eventKey);
  const isEventEnded = event?.status === "ended";

  const isOffline = !!(event?.location && !event?.virtualLink);
  const showQr = isOffline && (effectiveStatus === "confirmed" || effectiveStatus === "checked-in");

  const notGoingMutation = useMutation({
    mutationFn: async () => {
      if (!walletClient) throw new Error("Wallet not connected");
      const wasConfirmed =
        effectiveStatus === "confirmed" || effectiveStatus === "checked-in";
      const res = await updateTicketStatus(
        walletClient,
        publicClient,
        rsvpEntity.key as Hex,
        "not-going",
      );
      if (!res.success) throw new Error(res.error);
      if (wasConfirmed && eventKey) {
        await promoteFirstWaitlistedTicket(walletClient, publicClient, eventKey).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success("Marked as not going");
      onCancelled();
    },
    onError: (e) => toast.error(friendlyError(e)),
  });

  const statusStyle = STATUS_STYLE[effectiveStatus] ?? STATUS_STYLE.confirmed;

  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-900 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
        {}
        <div className="flex-1 min-w-0 space-y-1">
          {eventLoading ? (
            <div className="space-y-1.5">
              <div className="h-4 w-48 rounded bg-zinc-800 animate-pulse" />
              <div className="h-3 w-32 rounded bg-zinc-800 animate-pulse" />
            </div>
          ) : event ? (
            <>
              <Link
                href={`/events/${eventKey}`}
                className="block font-semibold text-white hover:text-violet-300 transition-colors truncate"
              >
                {event.title}
              </Link>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                <span className="flex items-center gap-1"><Calendar size={11} /> {formatDate(event.date)}</span>
                <span className="flex items-center gap-1"><MapPin size={11} /> {event.location}</span>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-zinc-400">Event</p>
              {eventKey && (
                <Link
                  href={`/events/${eventKey}`}
                  className="text-xs font-mono text-violet-400 hover:text-violet-300 transition-colors"
                >
                  {truncate(eventKey)}
                </Link>
              )}
            </div>
          )}

          {}
          {(rsvp.attendeeName || rsvp.attendeeEmail) && (
            <p className="text-xs text-zinc-600 pt-0.5">
              {rsvp.attendeeName}
              {rsvp.attendeeName && rsvp.attendeeEmail && " · "}
              {rsvp.attendeeEmail}
            </p>
          )}
        </div>

        {}
        <div className="flex items-center gap-3 shrink-0">
          {}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${statusStyle.dot}`} />
            <span className={`text-xs font-medium ${statusStyle.text}`}>
              {isCheckedIn ? "Checked in" : statusStyle.label}
            </span>
            {effectiveStatus === "waitlisted" && eventKey && (
              <WaitlistPosition eventKey={eventKey} myRsvpKey={rsvpEntity.key as Hex} />
            )}
          </div>

          {}
          <ChainLink entityKey={rsvpEntity.key} label="Verified ✓" />

          {}
          {!isCheckedIn &&
            !isEventEnded &&
            effectiveStatus !== "rejected" &&
            effectiveStatus !== "not-going" && (
            <>
              <button
                onClick={() => setConfirmOpen(true)}
                disabled={notGoingMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:border-rose-700/40 hover:bg-rose-950/20 hover:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <BanIcon size={11} />
                {notGoingMutation.isPending ? "Updating…" : "Not Going"}
              </button>
              <ConfirmModal
                open={confirmOpen}
                title="Mark as Not Going?"
                message="This will record that you are no longer attending. The organizer will be notified. This cannot be undone."
                confirmLabel="Not Going"
                destructive
                onConfirm={() => notGoingMutation.mutate()}
                onClose={() => setConfirmOpen(false)}
              />
            </>
          )}
        </div>
      </div>

      {}
      {notGoingMutation.isError && (
        <div className="border-t border-red-800/30 bg-red-950/20 px-5 py-2">
          <p className="text-xs text-red-400 font-mono">
            {notGoingMutation.error instanceof Error
              ? notGoingMutation.error.message
              : "Update failed"}
          </p>
        </div>
      )}

      {}
      {showQr && (
        <div className="border-t border-white/5 px-5 py-4 flex flex-col items-center gap-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Entry QR code</p>
          <div className="rounded-lg bg-white p-2">
            <QRCodeSVG value={rsvpEntity.key as string} size={120} level="M" />
          </div>
          <p className="text-xs text-zinc-600">Show at the venue</p>
        </div>
      )}

      {}
      {rsvp.message && (
        <div className="border-t border-white/5 px-5 py-3">
          <p className="text-xs text-zinc-500 italic">
            &ldquo;{rsvp.message}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

function WaitlistPosition({ eventKey, myRsvpKey }: { eventKey: Hex; myRsvpKey: Hex }) {
  const { data: position } = useQuery({
    queryKey: ["waitlist-position", eventKey, myRsvpKey],
    queryFn: async () => {
      const res = await getTicketsByEvent(publicClient, eventKey);
      if (!res.success) return null;
      const waitlisted = res.data.filter((e) =>
        e.attributes.find((a) => a.key === "status")?.value === "waitlisted",
      );
      const pos = waitlisted.findIndex((e) => e.key === myRsvpKey);
      return pos >= 0 ? pos + 1 : null;
    },
    staleTime: 60_000,
  });

  if (position == null) return null;
  return (
    <span className="rounded-full bg-amber-900/30 border border-amber-700/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
      #{position}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-white/10 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10">
        <Ticket size={24} className="text-zinc-500" />
      </div>
      <div>
        <p className="text-base font-semibold text-white">No RSVPs yet</p>
        <p className="mt-1 text-sm text-zinc-500">
          Browse events and RSVP to see them here
        </p>
      </div>
      <Link
        href="/events"
        className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
      >
        Browse Events
      </Link>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-white/5 bg-zinc-900 p-5 flex gap-4 items-center"
        >
          <div className="flex-1 space-y-2">
            <div className="h-4 w-56 rounded bg-zinc-800" />
            <div className="h-3 w-36 rounded bg-zinc-800" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
