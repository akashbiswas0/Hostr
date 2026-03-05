"use client";

import { useEffect, useRef, useState } from "react";
import type { Hex } from "viem";
import type { Entity } from "@arkiv-network/sdk";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import { X, Lock, AlertTriangle, Clock, CheckCircle2, XCircle, ExternalLink, Link as LinkIcon, ArrowRight } from "lucide-react";

import { useWallet } from "@/hooks/useWallet";
import { publicClient } from "@/lib/arkiv/client";
import { createRsvpEntity, promoteFirstWaitlisted } from "@/lib/arkiv/entities/rsvp"
import { updateRsvpCount, autoPromoteCapacityStatus } from "@/lib/arkiv/entities/event"
import { getRsvpByAttendee } from "@/lib/arkiv/queries/rsvps"
import { ConnectButton } from "@/components/ConnectButton";
import { friendlyError } from "@/lib/arkiv/errors";
import type { Event, RSVP } from "@/lib/arkiv/types";

export interface RsvpModalProps {
  
  open: boolean;
  
  onClose: () => void;
  
  entity: Entity;
  
  event: Event;
  
  isFull: boolean;
  
  onSuccess: () => void;
}

type Step = "form" | "submitting" | "success" | "error";

const EXPLORER = "https://explorer.kaolin.hoodi.arkiv.network";

function toMs(value: unknown): number {
  if (value == null || value === "") return NaN;
  if (typeof value === "number") return isFinite(value) ? value * 1_000 : NaN;
  const str = String(value);
  if (/^\d+$/.test(str)) return Number(str) * 1_000;
  const t = Date.parse(str);
  return isNaN(t) ? NaN : t;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-colors";

export function RsvpModal({
  open,
  onClose,
  entity,
  event,
  isFull,
  onSuccess,
}: RsvpModalProps) {
  const { address, isConnected, isCorrectChain, walletClient } = useWallet();

  // Does this event require organizer approval before confirming RSVPs?
  const requiresRsvp = !!event.requiresRsvp;
  // Is the event offline-only (has location but no virtual link)?
  const isOffline = !!event.location && !event.virtualLink;

  
  const [step, setStep] = useState<Step>("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [rsvpEntityKey, setRsvpEntityKey] = useState<Hex | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  
  const dialogRef = useRef<HTMLDivElement>(null);

  
  useEffect(() => {
    if (open) {
      setStep("form");
      setName("");
      setEmail("");
      setMessage("");
      setTxHash(null);
      setRsvpEntityKey(null);
      setErrorMsg("");
    }
  }, [open]);

  
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletClient || !address) return;

    setStep("submitting");
    setErrorMsg("");

    try {
      // ── Duplicate RSVP prevention ──────────────────────────────────────
      const existingRsvp = await getRsvpByAttendee(
        publicClient,
        entity.key as Hex,
        address as Hex,
      );
      if (existingRsvp.success && existingRsvp.data) {
        setErrorMsg("You've already RSVP'd to this event");
        setStep("error");
        return;
      }

      const endMs = toMs(event.endDate);
      const eventEndDate = isNaN(endMs)
        ? Math.floor(Date.now() / 1_000) + 86_400
        : Math.floor(endMs / 1_000);

      const rsvpData: RSVP = {
        eventKey: entity.key as Hex,
        attendeeName: name.trim(),
        attendeeEmail: email.trim(),
        message: message.trim() || undefined,
      };

      // If event requires approval → pending; if full → waitlisted; otherwise confirmed
      const status = isFull ? "waitlisted" : requiresRsvp ? "pending" : "confirmed";

      const createRes = await createRsvpEntity(
        walletClient,
        rsvpData,
        eventEndDate,
        status,
      );

      if (!createRes.success) throw new Error(createRes.error);

      const { entityKey: newEntityKey, txHash: newTxHash } = createRes.data;

      // Only increment rsvpCount for immediately confirmed RSVPs
      if (!isFull && !requiresRsvp) {
        const countRes = await updateRsvpCount(
          walletClient,
          publicClient,
          entity.key as Hex,
          true,
        );
        if (!countRes.success) throw new Error(countRes.error);
      }

      setTxHash(newTxHash);
      setRsvpEntityKey(newEntityKey);
      setStep("success");
      toast.success(
        isFull
          ? "Added to waitlist ✓"
          : requiresRsvp
          ? "Request submitted — awaiting organizer approval ✓"
          : "RSVP confirmed ✓",
      );
      if (!isFull && !requiresRsvp) {
        autoPromoteCapacityStatus(walletClient, publicClient, entity.key as Hex).catch(() => {});
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(friendlyError(msg));
      toast.error("Transaction failed — please try again");
      setStep("error");
    }
  }

  if (!open) return null;

  return (
    
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rsvp-modal-title"
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl shadow-black/60"
      >
        {}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {}
        {step === "form" && (
          <FormStep
            isFull={isFull}
            requiresRsvp={requiresRsvp}
            isConnected={isConnected}
            isCorrectChain={isCorrectChain}
            address={address ?? null}
            event={event}
            name={name} setName={setName}
            email={email} setEmail={setEmail}
            message={message} setMessage={setMessage}
            onSubmit={handleSubmit}
          />
        )}

        {step === "submitting" && <SubmittingStep isFull={isFull} requiresRsvp={requiresRsvp} />}

        {step === "success" && (
          <SuccessStep
            isFull={isFull}
            requiresRsvp={requiresRsvp}
            isOffline={isOffline}
            txHash={txHash}
            rsvpEntityKey={rsvpEntityKey}
            onClose={onClose}
          />
        )}

        {step === "error" && (
          <ErrorStep
            errorMsg={errorMsg}
            onRetry={() => setStep("form")}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function FormStep({
  isFull,
  requiresRsvp,
  isConnected,
  isCorrectChain,
  address,
  event,
  name, setName,
  email, setEmail,
  message, setMessage,
  onSubmit,
}: {
  isFull: boolean;
  requiresRsvp: boolean;
  isConnected: boolean;
  isCorrectChain: boolean;
  address: string | null;
  event: Event;
  name: string; setName: (v: string) => void;
  email: string; setEmail: (v: string) => void;
  message: string; setMessage: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const actionLabel = isFull
    ? "Join Waitlist"
    : requiresRsvp
    ? "Request to Join"
    : "RSVP to Event";

  return (
    <div className="p-6 space-y-5">
      {}
      <div className="pr-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
          {actionLabel}
        </p>
        <h2 id="rsvp-modal-title" className="text-lg font-bold text-white leading-snug">
          {event.title}
        </h2>
        {isFull && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-amber-950/40 border border-amber-700/30 px-3 py-2">
            <AlertTriangle size={13} className="text-amber-400 shrink-0" />
            <span className="text-amber-400 text-xs font-medium">
              Event is at capacity. You'll be added to the waitlist.
            </span>
          </div>
        )}
        {!isFull && requiresRsvp && (
          <div className="mt-2 flex items-center gap-2 rounded-lg bg-violet-950/40 border border-violet-700/30 px-3 py-2">
            <Lock size={13} className="text-violet-300 shrink-0" />
            <span className="text-violet-300 text-xs font-medium">
              Attendance requires organizer approval. Your request will be reviewed.
            </span>
          </div>
        )}
      </div>

      {/* Wallet guard */}
      {!isConnected ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-zinc-400">Connect your wallet to RSVP</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      ) : !isCorrectChain ? (
        <div className="space-y-3 text-center">
          <p className="text-sm text-amber-400">Switch to Kaolin to continue</p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      ) : (
        /* Form */
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Wallet display */}
          <div className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-zinc-800/50 px-3 py-2">
            <div className="h-5 w-5 shrink-0 rounded-full bg-gradient-to-br from-violet-600 to-pink-600" />
            <div className="min-w-0">
              <p className="text-xs text-zinc-500">RSVP will be owned by</p>
              <p className="font-mono text-xs text-white truncate">
                {address ? truncate(address) : "—"}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Name <span className="text-rose-400">*</span>
            </label>
            <input
              required
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Email <span className="text-rose-400">*</span>
            </label>
            <input
              required
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-400">
              Message to organizer{" "}
              <span className="text-zinc-600">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Say something…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`${inputCls} resize-none`}
            />
          </div>

          <p className="text-xs text-zinc-600">
            Your RSVP will be securely recorded and linked to your account.
          </p>

          <button
            type="submit"
            disabled={!name || !email}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-lg shadow-violet-900/30 flex items-center justify-center gap-2"
          >
            {isFull
              ? "Join Waitlist"
              : requiresRsvp
              ? "Send Request"
              : "Confirm RSVP"}
            <ArrowRight size={14} />
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Step: Submitting ─────────────────────────────────────────────────────────

function SubmittingStep({ isFull, requiresRsvp }: { isFull: boolean; requiresRsvp: boolean }) {
  const label = isFull
    ? "Joining waitlist…"
    : requiresRsvp
    ? "Submitting request…"
    : "Submitting RSVP…";
  return (
    <div className="p-10 flex flex-col items-center gap-5">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-2 border-violet-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-500 animate-spin" />
        <div className="absolute inset-2 rounded-full bg-violet-900/30 flex items-center justify-center">
          <LinkIcon size={16} className="text-violet-400" />
        </div>
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm text-zinc-500">
          Submitting — please approve in your wallet
        </p>
      </div>
    </div>
  );
}

// ─── Step: Success ────────────────────────────────────────────────────────────

function SuccessStep({
  isFull,
  requiresRsvp,
  isOffline,
  txHash,
  rsvpEntityKey,
  onClose,
}: {
  isFull: boolean;
  requiresRsvp: boolean;
  isOffline: boolean;
  txHash: Hex | null;
  rsvpEntityKey: Hex | null;
  onClose: () => void;
}) {
  const isPending = !isFull && requiresRsvp;

  return (
    <div className="p-8 flex flex-col items-center gap-5">
      {/* Icon */}
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
        isPending
          ? "bg-violet-900/40 border border-violet-600/30"
          : isFull
          ? "bg-amber-900/40 border border-amber-600/30"
          : "bg-emerald-900/40 border border-emerald-600/30"
      }`}>
        {isPending
          ? <Clock size={26} className="text-violet-300" />
          : isFull
          ? <Clock size={26} className="text-amber-300" />
          : <CheckCircle2 size={26} className="text-emerald-300" />}
      </div>

      <div className="text-center space-y-1">
        <p className={`text-lg font-bold ${isPending ? "text-violet-300" : isFull ? "text-amber-300" : "text-emerald-300"}`}>
          {isPending ? "Request submitted!" : isFull ? "You're on the waitlist!" : "You're in!"}
        </p>
        <p className="text-sm text-zinc-400">
          {isPending
            ? "The organizer will review and approve your request."
            : isFull
            ? "Waitlist RSVP confirmed ✓"
            : "RSVP confirmed ✓"}
        </p>
      </div>

      {/* QR code for confirmed, offline-only events */}
      {!isPending && !isFull && isOffline && rsvpEntityKey && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Your entry QR code</p>
          <div className="rounded-xl bg-white p-3">
            <QRCodeSVG
              value={rsvpEntityKey}
              size={160}
              level="M"
            />
          </div>
          <p className="text-xs text-zinc-500 text-center max-w-[200px]">
            Show this at the venue to check in. Also available in My RSVPs.
          </p>
        </div>
      )}

      {/* Links */}
      <div className="w-full space-y-2">
        {txHash && (
          <a
            href={`${EXPLORER}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full rounded-lg border border-white/5 bg-zinc-800 px-4 py-3 text-xs hover:bg-zinc-700/60 transition-colors group"
          >
            <span className="text-zinc-400 group-hover:text-white transition-colors">
              View transaction
            </span>
            <span className="font-mono text-violet-400 group-hover:text-violet-300 transition-colors inline-flex items-center gap-1">
              {txHash.slice(0, 10)}… <ExternalLink size={10} />
            </span>
          </a>
        )}
        {rsvpEntityKey && (
          <a
            href={`${EXPLORER}/entity/${rsvpEntityKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between w-full rounded-lg border border-white/5 bg-zinc-800 px-4 py-3 text-xs hover:bg-zinc-700/60 transition-colors group"
          >
            <span className="text-zinc-400 group-hover:text-white transition-colors">
              View RSVP entity
            </span>
            <span className="font-mono text-violet-400 group-hover:text-violet-300 transition-colors inline-flex items-center gap-1">
              {rsvpEntityKey.slice(0, 10)}… <ExternalLink size={10} />
            </span>
          </a>
        )}
      </div>

      <button
        onClick={onClose}
        className="w-full rounded-xl border border-white/10 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        Close
      </button>
    </div>
  );
}

// ─── Step: Error ──────────────────────────────────────────────────────────────

function ErrorStep({
  errorMsg,
  onRetry,
  onClose,
}: {
  errorMsg: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-8 flex flex-col items-center gap-5">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-900/30 border border-red-700/30">
        <XCircle size={28} className="text-red-400" />
      </div>

      <div className="text-center">
        <p className="text-base font-semibold text-white">Transaction failed</p>
        <p className="mt-1 text-xs text-zinc-500">
          Something went wrong submitting your RSVP.
        </p>
      </div>

      {errorMsg && (
        <div className="w-full rounded-lg border border-red-800/40 bg-red-950/20 px-4 py-3">
          <p className="text-xs text-red-400 font-mono break-all">{errorMsg}</p>
        </div>
      )}

      <div className="flex w-full gap-3">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onRetry}
          className="flex-1 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// No custom XIcon needed — using lucide X directly
