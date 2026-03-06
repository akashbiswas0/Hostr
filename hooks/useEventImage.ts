/**
 * Returns a URL that can be used directly in <img src> or CSS url().
 * The Next.js proxy at /api/imagedb/media/{id} forwards the request
 * server-side to ImageDB and returns the binary image with the correct
 * Content-Type header, so no client-side blob dance is needed.
 */
export function useEventImage(mediaId: string | undefined | null): string | null {
  if (!mediaId || !mediaId.trim()) return null;
  return `/api/imagedb/media/${mediaId}`;
}

