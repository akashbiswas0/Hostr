"use client";

import { useState } from "react";

interface AddressBadgeProps {
  address: string;

  full?: boolean;
  className?: string;
}

function truncate(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function AddressBadge({ address, full = false, className = "" }: AddressBadgeProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    });
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono text-xs ${className}`}
    >
      <span className="text-zinc-400">{full ? address : truncate(address)}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy address"
        className={`rounded p-0.5 transition-colors ${
          copied
            ? "text-emerald-400"
            : "text-zinc-600 hover:text-zinc-300"
        }`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </span>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="5" width="8" height="8" rx="1.5" />
      <path d="M3 11V3.5A1.5 1.5 0 0 1 4.5 2H12" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2">
      <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
