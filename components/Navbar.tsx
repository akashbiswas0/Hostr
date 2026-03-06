"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Hexagon } from "lucide-react";
import { ConnectButton } from "./ConnectButton";
import { NavAccountMenu } from "./NavAccountMenu";
import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";

interface NavbarProps {
  active?: "home" | "events" | "dashboard";
}

export function Navbar({ active }: NavbarProps) {
  const { address, disconnect, isConnected, isCorrectChain } = useWallet();
  const { isOrganizer } = useOrganizer();
  const [mobileOpen, setMobileOpen] = useState(false);
  const profileHref = address ? `/organizers/${address.toLowerCase()}` : "/organizer/onboard";
  const settingsHref =
    address && isOrganizer
      ? `/organizers/${address.toLowerCase()}/edit`
      : "/organizer/onboard";

  const linkCls = (name: NavbarProps["active"]) =>
    `text-sm font-semibold transition-colors ${
      active === name
        ? "text-white"
        : "text-zinc-300/80 hover:text-white"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/15 bg-[linear-gradient(90deg,rgba(86,77,106,0.7),rgba(37,14,58,0.75),rgba(86,77,106,0.7))] backdrop-blur-xl">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 sm:px-6">
        {}
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-bold tracking-tight"
        >
          <Hexagon size={18} className="text-cyan-300" strokeWidth={1.5} />
          <span className="text-white">
            Hostr
          </span>
        </Link>

        {}
        <div className="hidden items-center justify-center gap-8 sm:flex">
          <Link href="/" className={linkCls("home")}>
            Home
          </Link>
          <Link href="/events" className={linkCls("events")}>
            Events
          </Link>
          <Link
            href="/organizer/events/create"
            className="text-sm font-semibold text-violet-300 transition-colors hover:text-violet-200"
          >
            Create Event
          </Link>
        </div>

        {}
        <div className="hidden items-center gap-3 sm:flex">
          <NavAccountMenu />
        </div>

        {}
        <button
          className="sm:hidden rounded-lg p-2 text-zinc-300 hover:text-white transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {}
      {mobileOpen && (
        <div className="space-y-2 border-t border-white/10 bg-zinc-950/75 px-4 pb-4 pt-2 backdrop-blur-xl sm:hidden">
          <Link
            href="/"
            className="block py-2 text-sm font-medium text-zinc-400 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            Home
          </Link>
          <Link
            href="/events"
            className="block py-2 text-sm font-medium text-zinc-400 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            Events
          </Link>
          <Link
            href="/organizer/events/create"
            className="block py-2 text-sm font-medium text-violet-400 hover:text-violet-300"
            onClick={() => setMobileOpen(false)}
          >
            Create Event
          </Link>

          {isConnected && isCorrectChain && address && (
            <>
              <div className="my-2 h-px bg-white/10" />
              <Link
                href="/organizer/dashboard"
                className="block py-2 text-sm font-medium text-zinc-300 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href={profileHref}
                className="block py-2 text-sm font-medium text-zinc-300 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                View Profile
              </Link>
              <Link
                href={settingsHref}
                className="block py-2 text-sm font-medium text-zinc-300 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                Settings
              </Link>
              <button
                type="button"
                onClick={() => {
                  disconnect();
                  setMobileOpen(false);
                }}
                className="block w-full py-2 text-left text-sm font-medium text-rose-300 hover:text-rose-200"
              >
                Disconnect
              </button>
            </>
          )}

          {(!isConnected || !isCorrectChain) && (
            <div className="pt-2">
              <ConnectButton />
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
