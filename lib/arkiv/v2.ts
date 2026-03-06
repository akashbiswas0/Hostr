import { SCHEMA_VERSION } from "./constants";

const ALLOWED_MEDIA_PROTOCOLS = new Set(["https:", "ipfs:"]);

export function unixNow(): number {
  return Math.floor(Date.now() / 1_000);
}

export function toUnixSeconds(value: string | number): number {
  if (typeof value === "number") return Math.floor(value);
  if (/^\d+$/.test(value)) return Number(value);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / 1_000);
}

export function normalizeText(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function boolToNumber(value: boolean | undefined): 0 | 1 {
  return value ? 1 : 0;
}

export function normalizeMediaUrl(value: string | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";

  try {
    if (raw.startsWith("ipfs://")) {
      return raw.replace(/\s+/g, "");
    }
    const url = new URL(raw);
    if (!ALLOWED_MEDIA_PROTOCOLS.has(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function mediaHost(value: string | undefined): string {
  const normalized = normalizeMediaUrl(value);
  if (!normalized) return "";
  if (normalized.startsWith("ipfs://")) return "ipfs";

  try {
    return new URL(normalized).host.toLowerCase();
  } catch {
    return "";
  }
}

export function tokenizeSearch(value: string): string[] {
  return Array.from(
    new Set(
      normalizeText(value)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 2),
    ),
  );
}

export function ensureEvenSeconds(seconds: number): number {
  const safe = Math.max(1, Math.floor(seconds));
  return Math.floor(safe / 2) * 2;
}

export function schemaAttributes() {
  return [{ key: "schemaVersion", value: SCHEMA_VERSION }];
}
