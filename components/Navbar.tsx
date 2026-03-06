"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
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
        ? "text-zinc-100/90"
        : "text-zinc-200/55 hover:text-zinc-100/85"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-[linear-gradient(90deg,rgba(86,77,106,0.44),rgba(37,14,58,0.5),rgba(86,77,106,0.44))] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="shrink-0 text-base font-bold tracking-tight text-white"
        >
          Hostr
        </Link>

        <div className="hidden items-center gap-8 pl-4 sm:flex md:pl-8">
          <Link href="/" className={linkCls("home")}>
            Home
          </Link>
          <Link href="/events" className={linkCls("events")}>
            Events
          </Link>
          <Link href="/organizer/dashboard" className={linkCls("dashboard")}>
            Dashboard
          </Link>
          <Link
            href="/organizer/events/create"
            className="text-sm font-semibold text-violet-200/65 transition-colors hover:text-violet-100/85"
          >
            Create Event
          </Link>
        </div>

        <div className="ml-auto hidden min-w-[216px] items-center justify-end gap-3 sm:flex">
          <NavAccountMenu />
        </div>

        <button
          className="ml-auto rounded-lg p-2 text-zinc-300 transition-colors hover:text-white sm:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="space-y-2 border-t border-white/10 bg-zinc-950/65 px-4 pb-4 pt-2 backdrop-blur-xl sm:hidden">
          <Link
            href="/"
            className="block py-2 text-sm font-medium text-zinc-400/85 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            Home
          </Link>
          <Link
            href="/events"
            className="block py-2 text-sm font-medium text-zinc-400/85 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            Events
          </Link>
          <Link
            href="/organizer/dashboard"
            className="block py-2 text-sm font-medium text-zinc-400/85 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            Dashboard
          </Link>
          <Link
            href="/organizer/events/create"
            className="block py-2 text-sm font-medium text-violet-200/85 hover:text-violet-100"
            onClick={() => setMobileOpen(false)}
          >
            Create Event
          </Link>

          {isConnected && isCorrectChain && address && (
            <>
              <div className="my-2 h-px bg-white/10" />
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
