"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { ConnectButton } from "./ConnectButton";
import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";

interface NavbarProps {
  active?: "browse" | "my-rsvps" | "dashboard";
}

export function Navbar({ active }: NavbarProps) {
  const { isConnected } = useWallet();
  const { isOrganizer } = useOrganizer();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkCls = (name: NavbarProps["active"]) =>
    `text-sm font-medium transition-colors ${
      active === name
        ? "text-gray-900"
        : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {}
        <Link
          href="/"
          className="flex items-center gap-2 text-base font-bold tracking-tight"
        >
          <span className="text-xl">⬡</span>
          <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
            OnChain Events
          </span>
        </Link>

        {}
        <div className="hidden sm:flex items-center gap-6">
          <Link href="/#events" className={linkCls("browse")}>
            Browse
          </Link>
          {isConnected && (
            <Link href="/my-rsvps" className={linkCls("my-rsvps")}>
              My RSVPs
            </Link>
          )}
          {isConnected && isOrganizer && (
            <Link href="/organizer/dashboard" className={linkCls("dashboard")}>
              Dashboard
            </Link>
          )}
          {isConnected && !isOrganizer && (
            <Link
              href="/organizer/onboard"
              className="text-sm font-medium text-purple-600 hover:text-purple-700 transition-colors"
            >
              Host an Event
            </Link>
          )}
        </div>

        {}
        <div className="hidden sm:flex items-center gap-3">
          <ConnectButton />
        </div>

        {}
        <button
          className="sm:hidden rounded-lg p-2 text-gray-500 hover:text-gray-900 transition-colors"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-100 bg-white px-4 pb-4 pt-2 space-y-2">
          <Link
            href="/#events"
            className="block py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            onClick={() => setMobileOpen(false)}
          >
            Browse
          </Link>
          {isConnected && (
            <Link
              href="/my-rsvps"
              className="block py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              onClick={() => setMobileOpen(false)}
            >
              My RSVPs
            </Link>
          )}
          {isConnected && isOrganizer && (
            <Link
              href="/organizer/dashboard"
              className="block py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              onClick={() => setMobileOpen(false)}
            >
              Dashboard
            </Link>
          )}
          {isConnected && !isOrganizer && (
            <Link
              href="/organizer/onboard"
              className="block py-2 text-sm font-medium text-purple-600 hover:text-purple-700"
              onClick={() => setMobileOpen(false)}
            >
              Host an Event
            </Link>
          )}
          <div className="pt-2">
            <ConnectButton />
          </div>
        </div>
      )}
    </nav>
  );
}
