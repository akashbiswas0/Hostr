"use client";

import { useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Hex } from "viem";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  QrCode,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  User,
  ShieldOff,
  Lock,
  AlertTriangle,
  ScanLine,
} from "lucide-react";

import { useEvent } from "@/hooks/useEvent";
import { useWallet } from "@/hooks/useWallet";
import { publicClient } from "@/lib/arkiv/client";
import { ENTITY_TYPES } from "@/lib/arkiv/constants";
import { createCheckinEntity } from "@/lib/arkiv/entities/checkin";
import { createPoAEntity } from "@/lib/arkiv/entities/attendance";
import { getApprovalForTicket } from "@/lib/arkiv/queries/tickets";
import { hasAttendeeCheckedIn } from "@/lib/arkiv/queries/checkins";
import { friendlyError } from "@/lib/arkiv/errors";
import { OrganizerNav } from "@/components/OrganizerNav";
import { ConnectButton } from "@/components/ConnectButton";
import type { Ticket } from "@/lib/arkiv/types";

const QrScanner = dynamic(
  () => import("@/components/QrScanner").then((m) => m.QrScanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-52 text-zinc-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" />
        Loading camera…
      </div>
    ),
  },
);

type PageState =
  | { kind: "idle" }
  | { kind: "scanning" }
  | { kind: "manual" }
  | { kind: "verifying"; rsvpKey: string }
  | { kind: "success"; attendeeName: string; attendeeWallet: string; txHash: string }
  | { kind: "already-checked-in"; attendeeName: string }
  | { kind: "error"; message: string };

function truncate(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function toMs(value: unknown): number {
  if (!value && value !== 0) return NaN;
  const str = String(value);
  if (!str.trim()) return NaN;
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  return Date.parse(str);
}

const EXPLORER = "https://explorer.kaolin.hoodi.arkiv.network";

export default function CheckinPage() {
  const params = useParams();
  const entityKey = params.entityKey as Hex;

  const { event, entity: eventEntity, isLoading: isEventLoading } = useEvent(entityKey);
  const { address, isConnected, isCorrectChain, walletClient } = useWallet();

  const [state, setState] = useState<PageState>({ kind: "idle" });
  const [manualInput, setManualInput] = useState("");

  const processingRef = useRef(false);

  const processRsvpKey = useCallback(
    async (rawKey: string) => {
      if (!walletClient || !event) return;
      if (processingRef.current) return;
      processingRef.current = true;

      const rsvpKey = rawKey.trim() as Hex;
      setState({ kind: "verifying", rsvpKey });

      try {

        let rsvpEntity;
        try {
          rsvpEntity = await publicClient.getEntity(rsvpKey);
        } catch {
          setState({
            kind: "error",
            message: "Ticket entity not found. Make sure you scanned the correct QR code.",
          });
          return;
        }

        const typeAttr = rsvpEntity.attributes.find((a) => a.key === "type");
        if (typeAttr?.value !== ENTITY_TYPES.TICKET) {
          setState({ kind: "error", message: "Invalid QR code — this is not a ticket entity." });
          return;
        }

        const eventKeyAttr = rsvpEntity.attributes.find((a) => a.key === "eventKey");
        if ((eventKeyAttr?.value as string)?.toLowerCase() !== entityKey.toLowerCase()) {
          setState({ kind: "error", message: "This RSVP belongs to a different event." });
          return;
        }

        const statusAttr = rsvpEntity.attributes.find((a) => a.key === "status");
        const status = statusAttr?.value as string;

        if (status === "waitlisted") {
          setState({ kind: "error", message: "Cannot check in — this RSVP is on the waitlist." });
          return;
        }

        if (status !== "confirmed" && status !== "checked-in") {

          const approvalRes = await getApprovalForTicket(publicClient, rsvpKey);
          const isApproved = approvalRes.success && approvalRes.data !== null;
          if (!isApproved) {
            setState({
              kind: "error",
              message: "Cannot check in — this RSVP has not been approved yet.",
            });
            return;
          }

        }

        const walletAttr = rsvpEntity.attributes.find((a) => a.key === "attendeeWallet");
        const attendeeWallet = ((walletAttr?.value as string) || rsvpEntity.owner || "") as Hex;
        const rsvpData = rsvpEntity.toJson() as Ticket;
        const attendeeName = rsvpData.attendeeName || truncate(attendeeWallet);

        const alreadyRes = await hasAttendeeCheckedIn(publicClient, entityKey, attendeeWallet);
        if (alreadyRes.success && alreadyRes.data) {
          setState({ kind: "already-checked-in", attendeeName });
          return;
        }

        const endMs = toMs(event.endDate);
        const endDateSeconds = isNaN(endMs)
          ? Math.floor(Date.now() / 1_000) + 3_600
          : Math.floor(endMs / 1_000);

        const res = await createCheckinEntity(
          walletClient,
          publicClient,
          entityKey,
          attendeeWallet,
          endDateSeconds,
          rsvpKey,
          "qr",
        );
        if (!res.success) throw new Error(res.error);

        try {
          await createPoAEntity(
            walletClient,
            publicClient,
            entityKey,
            rsvpKey,
            attendeeWallet,
            res.data.entityKey,
          );
        } catch {  }

        toast.success(`${attendeeName} checked in ✓`);
        setState({
          kind: "success",
          attendeeName,
          attendeeWallet,
          txHash: res.data.txHash,
        });
      } catch (err) {
        setState({
          kind: "error",
          message: friendlyError(err),
        });
      } finally {
        processingRef.current = false;
      }
    },
    [walletClient, event, entityKey],
  );

  function reset() {
    setState({ kind: "idle" });
    setManualInput("");
  }

  if (!isConnected || !isCorrectChain) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
            {isConnected ? (
              <AlertTriangle size={24} className="text-amber-400" />
            ) : (
              <Lock size={24} className="text-violet-400" />
            )}
          </div>
          <h2 className="text-lg font-bold text-white">
            {isConnected ? "Wrong network" : "Sign in required"}
          </h2>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (isEventLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <OrganizerNav crumb="Check-in" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-violet-400" size={28} />
        </div>
      </div>
    );
  }

  if (!eventEntity || !event) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-white">Event not found</p>
      </div>
    );
  }

  if (address && eventEntity.owner && eventEntity.owner.toLowerCase() !== address.toLowerCase()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
        <div className="text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 border border-white/10 mx-auto">
            <ShieldOff size={22} className="text-rose-400" />
          </div>
          <p className="text-white font-bold">Organizer access only</p>
          <Link href="/" className="text-sm text-violet-400 hover:underline">
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <OrganizerNav crumb="Check-in" />

      <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
        {}
        <div>
          <Link
            href={`/organizer/events/${entityKey}/attendees`}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft size={14} /> Attendees
          </Link>
          <h1 className="text-2xl font-bold">Check-in Scanner</h1>
          <p className="text-zinc-400 text-sm mt-1">{event.title}</p>
        </div>

        {}
        {state.kind === "idle" && (
          <div className="space-y-3">
            <button
              onClick={() => setState({ kind: "scanning" })}
              className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-900 p-5 hover:border-violet-500/50 hover:bg-zinc-800/80 transition-all text-left"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600/20">
                <QrCode size={22} className="text-violet-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Scan QR Code</p>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Use camera to scan attendee&apos;s QR code
                </p>
              </div>
            </button>

            <button
              onClick={() => setState({ kind: "manual" })}
              className="w-full flex items-center gap-4 rounded-xl border border-white/10 bg-zinc-900 p-5 hover:border-violet-500/50 hover:bg-zinc-800/80 transition-all text-left"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-700/40">
                <KeyRound size={22} className="text-zinc-400" />
              </div>
              <div>
                <p className="font-semibold text-white">Enter RSVP Key</p>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Paste the RSVP key manually
                </p>
              </div>
            </button>
          </div>
        )}

        {}
        {state.kind === "scanning" && (
          <div className="space-y-4">
            <div className="rounded-xl overflow-hidden border border-white/10 bg-zinc-900">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <ScanLine size={16} className="text-violet-400" />
                <span className="text-sm font-medium">
                  Point camera at attendee&apos;s QR code
                </span>
              </div>
              <div className="p-4">
                <QrScanner
                  onScan={(result) => processRsvpKey(result)}
                  onError={(err) =>
                    setState({ kind: "error", message: `Camera error: ${err}` })
                  }
                />
              </div>
            </div>
            <button
              onClick={reset}
              className="w-full rounded-xl border border-white/10 py-3 text-sm text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {}
        {state.kind === "manual" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 bg-zinc-900 p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                  RSVP Key
                </label>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="0x…"
                  className="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm font-mono text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors"
                />
              </div>
              <button
                disabled={!manualInput.trim()}
                onClick={() => processRsvpKey(manualInput)}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Verify &amp; Check In
              </button>
            </div>
            <button
              onClick={reset}
              className="w-full rounded-xl border border-white/10 py-3 text-sm text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {}
        {state.kind === "verifying" && (
          <div className="rounded-xl border border-white/10 bg-zinc-900 p-8 text-center space-y-4">
            <Loader2 className="animate-spin text-violet-400 mx-auto" size={32} />
            <div>
              <p className="font-semibold text-white">Verifying RSVP…</p>
              <p className="text-xs font-mono text-zinc-600 mt-1 break-all">
                {state.rsvpKey}
              </p>
            </div>
          </div>
        )}

        {}
        {state.kind === "success" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/30 p-6 text-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 mx-auto">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white">Checked In!</p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <User size={14} className="text-zinc-400" />
                  <span className="text-zinc-300 font-medium">{state.attendeeName}</span>
                </div>
                <p className="font-mono text-xs text-zinc-600 mt-1">
                  {truncate(state.attendeeWallet)}
                </p>
              </div>
              <a
                href={`${EXPLORER}/tx/${state.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs text-violet-400 hover:underline"
              >
                View transaction ↗
              </a>
            </div>
            <button
              onClick={reset}
              className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
            >
              Check In Next Attendee
            </button>
          </div>
        )}

        {}
        {state.kind === "already-checked-in" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-700/30 bg-amber-950/30 p-6 text-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/20 mx-auto">
                <AlertTriangle size={32} className="text-amber-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white">Already Checked In</p>
                <p className="text-zinc-400 text-sm mt-1">
                  {state.attendeeName} was already checked in.
                </p>
              </div>
            </div>
            <button
              onClick={reset}
              className="w-full rounded-xl border border-white/10 py-3 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Scan Another
            </button>
          </div>
        )}

        {}
        {state.kind === "error" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-rose-700/30 bg-rose-950/30 p-6 text-center space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20 mx-auto">
                <XCircle size={32} className="text-rose-400" />
              </div>
              <div>
                <p className="text-xl font-bold text-white">Check-in Failed</p>
                <p className="text-zinc-400 text-sm mt-2">{state.message}</p>
              </div>
            </div>
            <button
              onClick={reset}
              className="w-full rounded-xl border border-white/10 py-3 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
