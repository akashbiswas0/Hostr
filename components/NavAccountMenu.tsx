"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
} from "lucide-react";

import { ConnectButton } from "@/components/ConnectButton";
import { useOrganizer } from "@/hooks/useOrganizer";
import { useWallet } from "@/hooks/useWallet";

interface NavAccountMenuProps {
  className?: string;
}

function truncate(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function toInitials(address: string): string {
  return address.slice(2, 4).toUpperCase();
}

export function NavAccountMenu({ className }: NavAccountMenuProps) {
  const { address, isConnected, isCorrectChain, disconnect } = useWallet();
  const { isOrganizer } = useOrganizer();

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const profileHref = useMemo(() => {
    if (!address) return "/organizer/onboard";
    return `/organizers/${address.toLowerCase()}`;
  }, [address]);

  const settingsHref = useMemo(() => {
    if (!address) return "/organizer/onboard";
    return isOrganizer ? `/organizers/${address.toLowerCase()}/edit` : "/organizer/onboard";
  }, [address, isOrganizer]);

  useEffect(() => {
    if (!open) return;

    const onOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onOutsideClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  if (!isConnected || !address || !isCorrectChain) {
    return <ConnectButton className={className} />;
  }

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/10 hover:text-white";

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-2.5 py-1.5 text-xs text-white transition-colors hover:bg-white/[0.14]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-cyan-300 to-violet-400 text-[10px] font-bold text-zinc-900">
          {toInitials(address)}
        </span>
        <span className="font-mono text-[11px] text-zinc-200">{truncate(address)}</span>
        <ChevronDown
          size={14}
          className={`text-zinc-300 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/10 bg-[#101a35]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <div className="mb-2 rounded-xl bg-white/[0.04] px-3 py-2">
            <p className="text-sm font-semibold text-white">Account</p>
            <p className="font-mono text-xs text-zinc-400">{truncate(address)}</p>
          </div>

          <Link href="/organizer/dashboard" onClick={() => setOpen(false)} className={menuItemClass}>
            <LayoutDashboard size={15} />
            Dashboard
          </Link>
          <Link href="/attendee/pope" onClick={() => setOpen(false)} className={menuItemClass}>
            <BadgeCheck size={15} />
            POP
          </Link>
          <Link href={profileHref} onClick={() => setOpen(false)} className={menuItemClass}>
            <User size={15} />
            View Profile
          </Link>
          <Link href={settingsHref} onClick={() => setOpen(false)} className={menuItemClass}>
            <Settings size={15} />
            Settings
          </Link>
          <button
            type="button"
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className={`${menuItemClass} text-rose-200 hover:bg-rose-500/15 hover:text-rose-100`}
          >
            <LogOut size={15} />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
