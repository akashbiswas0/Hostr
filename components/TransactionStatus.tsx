"use client";

import type { Hex } from "viem";
import { Check, X } from "lucide-react";
import { ChainLink } from "./ChainLink";
import { friendlyError } from "@/lib/arkiv/errors";

export type TxState = "idle" | "pending" | "success" | "error";

export interface TransactionStatusProps {
  state: TxState;
  successMessage?: string;
  error?: string;
  
  entityKey?: Hex | null;
  
  txHash?: Hex | null;
  onRetry?: () => void;
}

export function TransactionStatus({
  state,
  successMessage = "Saved successfully",
  error,
  entityKey,
  txHash,
  onRetry,
}: TransactionStatusProps) {
  if (state === "idle") return null;

  if (state === "pending") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-zinc-900 px-4 py-3">
        <SpinnerIcon className="h-4 w-4 shrink-0 text-violet-400" />
        <span className="text-sm text-zinc-300">Saving…</span>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="rounded-xl border border-emerald-700/30 bg-emerald-950/20 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <span className="text-sm text-emerald-300 font-medium">{successMessage}</span>
        </div>
        {(entityKey || txHash) && (
          <ChainLink entityKey={entityKey} txHash={txHash} />
        )}
      </div>
    );
  }

  
  return (
    <div className="rounded-xl border border-red-800/30 bg-red-950/20 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-red-400">✕</span>
        <span className="text-sm text-red-300 font-medium">Something went wrong — please try again</span>
      </div>
      {error && (
        <p className="text-xs text-red-400/70 break-all">{friendlyError(error)}</p>
      )}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg bg-red-900/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/50 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? "h-4 w-4"}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
