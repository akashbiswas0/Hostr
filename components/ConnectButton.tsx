"use client";

import { ConnectKitButton } from "connectkit";
import { Wallet } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";

function truncate(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

interface ConnectButtonProps {
  className?: string;
}

export function ConnectButton({ className }: ConnectButtonProps) {
  const { address, isConnected, isCorrectChain, switchToKaolin, disconnect } =
    useWallet();

  return (
    <ConnectKitButton.Custom>
      {({ isConnecting, show }) => {
        
        if (!isConnected || !address) {
          return (
            <button
              onClick={show}
              disabled={isConnecting}
              className={[
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold",
                "border-2 border-transparent bg-gradient-to-r from-purple-500 to-pink-500",
                "text-white hover:opacity-90 shadow-sm",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-150",
                className ?? "",
              ]
                .join(" ")
                .trim()}
            >
              {isConnecting ? (
                <>
                  <Spinner />
                  Connecting…
                </>
              ) : (
                <>
                  <Wallet size={15} />
                  Connect Wallet
                </>
              )}
            </button>
          );
        }

        
        if (!isCorrectChain) {
          return (
            <div className={`flex items-center gap-2 ${className ?? ""}`}>
              <span className="rounded-full bg-zinc-800 px-3 py-1 font-mono text-xs text-zinc-300">
                {truncate(address)}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-medium text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Wrong network
              </span>
              <button
                onClick={switchToKaolin}
                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
              >
                Switch to Kaolin
              </button>
            </div>
          );
        }

        
        const initials = address.slice(2, 4).toUpperCase();
        return (
          <div className={`flex items-center gap-2 ${className ?? ""}`}>
            {}
            <button
              onClick={show}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 hover:border-gray-300 hover:shadow-sm transition-all"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-[10px] font-bold text-white">
                {initials}
              </span>
              <span className="font-mono text-xs text-gray-700">
                {truncate(address)}
              </span>
            </button>

            {}
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Kaolin
            </span>

            {}
            <button
              onClick={disconnect}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
            >
              Disconnect
            </button>
          </div>
        );
      }}
    </ConnectKitButton.Custom>
  );
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
