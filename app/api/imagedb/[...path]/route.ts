import { NextRequest, NextResponse } from "next/server";

const IMAGEDB_URL = "http://localhost:3001";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");
  const body = await req.blob();

  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (
      ["idempotency-key", "btl-days", "x-user-id", "content-type"].includes(
        key.toLowerCase(),
      )
    ) {
      headers[key] = value;
    }
  });

  const res = await fetch(`${IMAGEDB_URL}/${pathStr}`, {
    method: "POST",
    headers,
    body,
  });

  const data = await res.blob();
  return new NextResponse(data, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const pathStr = path.join("/");

  const res = await fetch(`${IMAGEDB_URL}/${pathStr}`);
  const data = await res.blob();

  return new NextResponse(data, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
    },
  });
}
