/**
 * Client-side helpers for uploading and retrieving images through the
 * embedded ImageDB API routes (/api/imagedb/media).
 *
 * Images are stored on the Arkiv blockchain – no separate server required.
 */

/**
 * Upload a file and return its media_id (UUID string).
 * Call this from the browser – it posts to the Next.js API route.
 */
export async function uploadEventImage(file: File): Promise<string> {
  const idempotencyKey = `event-${Date.now()}-${file.name}`;
  console.log("[imagedb] uploading", { name: file.name, size: file.size });

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/imagedb/media", {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
      "BTL-Days": "30",
    },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ImageDB upload failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  console.log("[imagedb] upload response:", json);

  if (!json.media_id) {
    throw new Error(`Unexpected response from ImageDB: ${JSON.stringify(json)}`);
  }

  return json.media_id as string;
}
