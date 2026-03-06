"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { Hex } from "viem";

const EXPLORER = "https://explorer.kaolin.hoodi.arkiv.network";

interface ChainLinkProps {
  entityKey?: Hex | string | null;
  txHash?: Hex | string | null;

  label?: string;
}

export function ChainLink({ entityKey, txHash, label }: ChainLinkProps) {
  const [open, setOpen] = useState(false);

  const hasEntity = !!entityKey;
  const hasTx = !!txHash;
  if (!hasEntity && !hasTx) return null;

  return (
    <div className="inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {label ?? "View on-chain"}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-white/5 bg-zinc-900 p-3">
          {hasEntity && (
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-600 pt-0.5">
                Entity
              </span>
              <a
                href={`${EXPLORER}/entity/${entityKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-[11px] text-violet-300 hover:underline inline-flex items-center gap-1"
              >
                {entityKey} <ExternalLink size={10} />
              </a>
            </div>
          )}
          {hasTx && (
            <div className="flex items-start gap-2">
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-zinc-600 pt-0.5">
                Tx
              </span>
              <a
                href={`${EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all font-mono text-[11px] text-violet-300 hover:underline inline-flex items-center gap-1"
              >
                {txHash} <ExternalLink size={10} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
