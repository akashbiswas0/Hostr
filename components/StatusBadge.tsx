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
    dot: "bg-gray-400",
    badge: "bg-gray-100 text-gray-500",
  },
  upcoming: {
    label: "Upcoming",
    dot: "bg-purple-400",
    badge: "bg-purple-50 text-purple-700",
  },
  live: {
    label: "Full",
    dot: "bg-emerald-400",
    badge: "bg-emerald-50 text-emerald-700",
  },
  ended: {
    label: "Ended",
    dot: "bg-gray-300",
    badge: "bg-gray-100 text-gray-400",
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
