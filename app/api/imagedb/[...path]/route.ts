/**
 * Unified ImageDB API route – handles upload and retrieval directly on-chain.
 * No separate imageDB server required.
 *
 * POST /api/imagedb/media          – upload an image
 * GET  /api/imagedb/media/:id      – retrieve an image
 */
import { NextRequest, NextResponse } from "next/server";
import { uploadMedia, getMedia } from "@/lib/imagedb/upload";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  if (path[0] !== "media") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const idempotencyKey =
      req.headers.get("idempotency-key") ?? crypto.randomUUID();
    const btlDays = parseInt(req.headers.get("btl-days") ?? "30", 10);

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadMedia(
      fileBuffer,
      file.name,
      file.type,
      idempotencyKey,
      btlDays,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      media_id: result.media_id,
      message: "Upload successful",
    });
  } catch (err) {
    console.error("[imagedb] upload error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  // GET /api/imagedb/media/:id
  if (path[0] === "media" && path[1]) {
    const media_id = path[1];
    try {
      const result = await getMedia(media_id);
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: result.error.includes("not found") ? 404 : 500 },
        );
      }
      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          "Content-Type": result.metadata.content_type,
          "Content-Length": result.metadata.file_size.toString(),
          "Content-Disposition": `inline; filename="${result.metadata.filename}"`,
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch (err) {
      console.error("[imagedb] retrieve error:", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
