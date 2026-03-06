/**
 * Returns a URL that can be used directly in <img src> or CSS url().
 * Accepts:
 * - raw ImageDB media IDs
 * - full http(s) URLs
 * - ipfs:// URLs
 * - already-proxied /api/imagedb/media/... paths
 */
export function useEventImage(source: string | undefined | null): string | null {
  const raw = source?.trim();
  if (!raw) return null;

  if (raw.startsWith("/api/imagedb/media/")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("ipfs://")) return `https://ipfs.io/ipfs/${raw.slice("ipfs://".length)}`;

  return `/api/imagedb/media/${encodeURIComponent(raw)}`;
}
