"use client";

import Link from "next/link";
import { Plus, Hexagon } from "lucide-react";
import { ConnectButton } from "@/components/ConnectButton";

interface OrganizerNavProps {
  crumb?: string;
}

export function OrganizerNav({ crumb }: OrganizerNavProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="flex items-center gap-1.5 font-semibold text-white hover:text-violet-300 transition-colors"
          >
            <Hexagon size={14} className="text-violet-400" strokeWidth={1.5} />
            OnChain Events
          </Link>
          <span className="text-white/10">/</span>
          <Link
            href="/organizer/dashboard"
            className="text-zinc-500 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          {crumb && (
            <>
              <span className="text-white/10">/</span>
              <span className="text-zinc-300 font-medium">{crumb}</span>
            </>
          )}
        </div>

        {}
        <div className="flex items-center gap-3">
          <Link
            href="/organizer/events/create"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            <Plus size={14} />
            Create Event
          </Link>
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
