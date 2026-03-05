"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Hexagon } from "lucide-react";
import { ConnectButton } from "./ConnectButton";
import { NavAccountMenu } from "./NavAccountMenu";
import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";

interface NavbarProps {
  active?: "home" | "events" | "my-rsvps" | "dashboard";
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
    `text-sm font-medium transition-colors ${
      active === name
        ? "text-white"
        : "text-zinc-400 hover:text-white"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-transparent backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/20">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
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
        <div className="hidden sm:flex items-center gap-6">
          <Link href="/" className={linkCls("home")}>
            Home
          </Link>
          <Link href="/events" className={linkCls("events")}>
            Events
          </Link>
          {isConnected && (
            <Link href="/my-rsvps" className={linkCls("my-rsvps")}>
              My RSVPs
            </Link>
          )}
          {isConnected && !isOrganizer && (
            <Link
              href="/organizer/onboard"
              className="text-sm font-medium text-violet-400 hover:text-violet-300 transition-colors"
            >
              Host an Event
            </Link>
          )}
        </div>

        {}
        <div className="hidden sm:flex items-center gap-3">
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
        <div className="sm:hidden border-t border-white/10 bg-zinc-950/70 px-4 pb-4 pt-2 backdrop-blur-xl space-y-2">
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
          {isConnected && (
            <Link
              href="/my-rsvps"
              className="block py-2 text-sm font-medium text-zinc-400 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              My RSVPs
            </Link>
          )}
          {isConnected && !isOrganizer && (
            <Link
              href="/organizer/onboard"
              className="block py-2 text-sm font-medium text-violet-400 hover:text-violet-300"
              onClick={() => setMobileOpen(false)}
            >
              Host an Event
            </Link>
          )}

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
