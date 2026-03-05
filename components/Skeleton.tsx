

const pulse = "animate-pulse rounded bg-zinc-800";

export function EventCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-zinc-900">
      {}
      <div className={`${pulse} h-40 w-full rounded-none`} />
      <div className="p-4 space-y-3">
        <div className={`${pulse} h-4 w-3/4`} />
        <div className={`${pulse} h-3 w-1/2`} />
        <div className="flex gap-2 pt-1">
          <div className={`${pulse} h-5 w-16 rounded-full`} />
          <div className={`${pulse} h-5 w-20 rounded-full`} />
        </div>
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex gap-5 animate-pulse">
      <div className="h-24 w-24 shrink-0 rounded-full bg-zinc-800 sm:h-28 sm:w-28" />
      <div className="flex-1 space-y-3 pt-2">
        <div className={`${pulse} h-6 w-48`} />
        <div className={`${pulse} h-3 w-32`} />
        <div className={`${pulse} h-3 w-64`} />
        <div className="flex gap-2 pt-1">
          <div className={`${pulse} h-5 w-20 rounded-full`} />
          <div className={`${pulse} h-5 w-24 rounded-full`} />
        </div>
      </div>
    </div>
  );
}

export function AttendeeRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 animate-pulse">
      <div className="flex-1 space-y-2">
        <div className={`${pulse} h-3 w-32`} />
        <div className={`${pulse} h-4 w-48`} />
      </div>
      <div className={`${pulse} h-6 w-16 rounded-full`} />
      <div className={`${pulse} h-8 w-20 rounded-lg`} />
    </div>
  );
}

export function StatTileSkeleton() {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-900 p-4 animate-pulse space-y-2">
      <div className={`${pulse} h-7 w-12`} />
      <div className={`${pulse} h-3 w-16`} />
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <div className="h-14 border-b border-white/5 bg-zinc-900" />
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-5">
        <div className={`${pulse} h-8 w-56`} />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`${pulse} h-24 w-full rounded-2xl`} />
        ))}
      </div>
    </div>
  );
}
