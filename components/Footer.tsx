

import Link from "next/link";
import { ExternalLink, Hexagon } from "lucide-react";

const EXPLORER = "https://explorer.kaolin.hoodi.arkiv.network";
const ARKIV_SITE = "https://arkiv.network";

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-zinc-950 mt-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
          {}
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-1.5 justify-center sm:justify-start">
              <Hexagon size={14} className="text-cyan-300" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-white">Hostr</p>
            </div>
            <p className="mt-0.5 text-xs text-zinc-600">
              Decentralised event management · Kaolin Testnet
            </p>
          </div>

          {}
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-zinc-600">
            <Link href="/" className="hover:text-zinc-400 transition-colors">
              Home
            </Link>
            <Link href="/events" className="hover:text-zinc-400 transition-colors">
              Events
            </Link>
            <Link href="/my-rsvps" className="hover:text-zinc-400 transition-colors">
              My RSVPs
            </Link>
            <Link href="/organizer/onboard" className="hover:text-zinc-400 transition-colors">
              Become an Organizer
            </Link>
            <a
              href={EXPLORER}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-400 transition-colors inline-flex items-center gap-1"
            >
              Kaolin Explorer <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {}
        <div className="mt-6 flex flex-col items-center gap-1 border-t border-white/5 pt-6 sm:flex-row sm:justify-between">
          <p className="text-xs text-zinc-700">© 2026 Hostr</p>
          <a
            href={ARKIV_SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-700 hover:text-zinc-400 transition-colors"
          >
            Powered by
            <span className="font-semibold text-violet-400">Arkiv</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
