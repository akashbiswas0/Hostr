export type PopularTimeZoneOption = {
  id: string;
  label: string;
};

export const POPULAR_TIME_ZONES: PopularTimeZoneOption[] = [
  { id: "America/Los_Angeles", label: "Pacific Time - Los Angeles" },
  { id: "America/Chicago", label: "Central Time - Chicago" },
  { id: "America/Toronto", label: "Eastern Time - Toronto" },
  { id: "America/New_York", label: "Eastern Time - New York" },
  { id: "America/Sao_Paulo", label: "Brasilia Standard Time - Sao Paulo" },
  { id: "Europe/London", label: "United Kingdom Time - London" },
  { id: "Europe/Madrid", label: "Central European Time - Madrid" },
  { id: "Europe/Paris", label: "Central European Time - Paris" },
  { id: "Asia/Dubai", label: "Gulf Standard Time - Dubai" },
  { id: "Asia/Kolkata", label: "India Standard Time - Kolkata" },
  { id: "Asia/Singapore", label: "Singapore Standard Time - Singapore" },
  { id: "Asia/Tokyo", label: "Japan Standard Time - Tokyo" },
];

const UTC = "UTC";

function getSupportedTimeZones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    try {
      const values = Intl.supportedValuesOf("timeZone");
      if (values.includes(UTC)) return values;
      return [UTC, ...values];
    } catch {
      return [UTC];
    }
  }
  return [UTC];
}

export const ALL_TIME_ZONES = getSupportedTimeZones();

export function isValidTimeZone(timeZone: string): boolean {
  return ALL_TIME_ZONES.includes(timeZone);
}

export function browserTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!zone) return UTC;
  return isValidTimeZone(zone) ? zone : UTC;
}

export function normalizeEventTimeZone(timeZone?: string): string {
  if (!timeZone) return browserTimeZone();
  return isValidTimeZone(timeZone) ? timeZone : UTC;
}

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  });
}

function partsFromMs(ms: number, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const result = {
    year: 1970,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    second: 0,
  };

  const parts = partsFormatter(timeZone).formatToParts(new Date(ms));
  for (const part of parts) {
    if (part.type === "year") result.year = Number(part.value);
    if (part.type === "month") result.month = Number(part.value);
    if (part.type === "day") result.day = Number(part.value);
    if (part.type === "hour") result.hour = Number(part.value);
    if (part.type === "minute") result.minute = Number(part.value);
    if (part.type === "second") result.second = Number(part.value);
  }

  return result;
}

export function parseUnknownToMs(value: unknown): number {
  if (value == null || value === "") return Number.NaN;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value * 1_000 : Number.NaN;
  }
  const asText = String(value);
  if (/^\d+$/.test(asText)) return Number(asText) * 1_000;
  const parsed = Date.parse(asText);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseLocalDateTime(value: string):
  | { year: number; month: number; day: number; hour: number; minute: number }
  | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
}

export function toUtcMsFromZonedLocal(localDateTime: string, timeZone: string): number {
  const parsed = parseLocalDateTime(localDateTime);
  if (!parsed) return Number.NaN;

  const targetUtcEquivalent = Date.UTC(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hour,
    parsed.minute,
    0,
    0,
  );

  const adjust = (candidateMs: number): number => {
    const actual = partsFromMs(candidateMs, timeZone);
    const actualUtcEquivalent = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      0,
    );
    return candidateMs + (targetUtcEquivalent - actualUtcEquivalent);
  };

  let result = adjust(targetUtcEquivalent);
  result = adjust(result);
  return result;
}

export function zonedLocalToUtcIso(localDateTime: string, timeZone: string): string {
  const ms = toUtcMsFromZonedLocal(localDateTime, timeZone);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toISOString();
}

export function formatLocalDateTimeFromUtc(value: unknown, timeZone: string): string {
  const ms = parseUnknownToMs(value);
  if (Number.isNaN(ms)) return "";
  const parts = partsFromMs(ms, timeZone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

export function toCityName(timeZone: string): string {
  if (timeZone === UTC) return UTC;
  const city = timeZone.split("/").at(-1) ?? timeZone;
  return city.replaceAll("_", " ");
}

function normalizeOffsetLabel(offsetLabel: string): string {
  const match = offsetLabel.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    if (offsetLabel === "GMT") return "GMT+00:00";
    return offsetLabel;
  }
  const sign = match[1];
  const hour = match[2].padStart(2, "0");
  const minutes = (match[3] ?? "00").padStart(2, "0");
  return `GMT${sign}${hour}:${minutes}`;
}

export function getTimeZoneOffsetLabel(timeZone: string, date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const raw = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
  return normalizeOffsetLabel(raw);
}

export function formatDateInTimeZone(
  value: unknown,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  const ms = parseUnknownToMs(value);
  if (Number.isNaN(ms)) return "";
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone,
  }).format(new Date(ms));
}
