import type { EventStatus } from "@/lib/arkiv/types";

interface StatusBadgeProps {
  status: EventStatus;
  className?: string;
}

const CONFIG: Record<
  EventStatus,
  { label: string; dot: string; badge: string }
> = {
  draft: {
    label: "Draft",
    dot: "bg-zinc-500",
    badge: "bg-zinc-800/60 text-zinc-400 ring-1 ring-zinc-700/50",
  },
  upcoming: {
    label: "Upcoming",
    dot: "bg-violet-400",
    badge: "bg-violet-900/30 text-violet-300 ring-1 ring-violet-700/40",
  },
  live: {
    label: "Live",
    dot: "bg-emerald-400 animate-pulse",
    badge: "bg-emerald-900/30 text-emerald-300 ring-1 ring-emerald-700/40",
  },
  ended: {
    label: "Ended",
    dot: "bg-zinc-600",
    badge: "bg-zinc-800/60 text-zinc-500 ring-1 ring-zinc-700/50",
  },
  archived: {
    label: "Archived",
    dot: "bg-zinc-700",
    badge: "bg-zinc-900/70 text-zinc-400 ring-1 ring-zinc-700/50",
  },
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const { label, dot, badge } = CONFIG[status] ?? CONFIG.upcoming;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide ${badge} ${className}`}
    >
      {status !== "live" && (
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      )}
      {label}
    </span>
  );
}
