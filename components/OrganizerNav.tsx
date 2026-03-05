"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { ConnectButton } from "@/components/ConnectButton";

interface OrganizerNavProps {
  crumb?: string;
}

export function OrganizerNav({ crumb }: OrganizerNavProps) {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="font-semibold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent"
          >
            OnChain Events
          </Link>
          <span className="text-gray-300">/</span>
          <Link
            href="/organizer/dashboard"
            className="text-gray-500 hover:text-gray-900 transition-colors"
          >
            Dashboard
          </Link>
          {crumb && (
            <>
              <span className="text-gray-300">/</span>
              <span className="text-gray-900 font-medium">{crumb}</span>
            </>
          )}
        </div>

        {}
        <div className="flex items-center gap-3">
          <Link
            href="/organizer/events/create"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shadow-sm"
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
