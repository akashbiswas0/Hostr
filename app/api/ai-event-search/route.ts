import { NextRequest, NextResponse } from "next/server";
import { EVENT_CATEGORIES } from "@/lib/arkiv/categories";

type SearchFilters = {
  keyword: string;
  category: string;
  location: string;
  dateFrom: string;
  dateTo: string;
  status: "" | "upcoming" | "live";
  format: "" | "in_person" | "online" | "hybrid";
  approvalMode: "" | "auto" | "manual";
  availability: "" | "open";
  hasImage: "" | "with-image";
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const CATEGORY_LIST = [...EVENT_CATEGORIES] as string[];

function asTrimmed(value: unknown, maxLength = 80): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function normalizeDate(value: unknown): string {
  const date = asTrimmed(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | "" {
  const next = asTrimmed(value, 32);
  if (!next) return "";
  return (allowed as readonly string[]).includes(next) ? (next as T[number]) : "";
}

function normalizeCategory(value: unknown): string {
  const raw = asTrimmed(value, 48);
  if (!raw) return "";

  const exact = CATEGORY_LIST.find((category) => category.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;

  const lower = raw.toLowerCase();
  if (lower.includes("food") || lower.includes("drink")) return "Food & Drink";
  if (lower.includes("art") || lower.includes("culture")) return "Arts & Culture";
  if (lower.includes("fitness") || lower.includes("workout") || lower.includes("gym")) return "Fitness";
  if (lower.includes("wellness") || lower.includes("health") || lower.includes("yoga")) return "Wellness";
  if (lower.includes("climate") || lower.includes("sustain")) return "Climate";
  if (lower.includes("crypto") || lower.includes("blockchain")) return "Crypto";
  if (lower.includes("ai") || lower.includes("artificial intelligence") || lower.includes("ml")) return "AI";
  if (lower.includes("tech") || lower.includes("developer") || lower.includes("engineering")) return "Tech";

  return "";
}

function extractMessageContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (!Array.isArray(raw)) return "";

  return raw
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "type" in part && "text" in part && (part as { type?: unknown }).type === "text") {
        return String((part as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("")
    .trim();
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    return null;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      return null;
    } catch {
      return null;
    }
  }
}

function normalizeFilters(raw: Record<string, unknown>): SearchFilters {
  return {
    keyword: asTrimmed(raw.keyword, 160),
    category: normalizeCategory(raw.category),
    location: asTrimmed(raw.location, 80),
    dateFrom: normalizeDate(raw.dateFrom),
    dateTo: normalizeDate(raw.dateTo),
    status: normalizeEnum(raw.status, ["upcoming", "live"] as const),
    format: normalizeEnum(raw.format, ["in_person", "online", "hybrid"] as const),
    approvalMode: normalizeEnum(raw.approvalMode, ["auto", "manual"] as const),
    availability: normalizeEnum(raw.availability, ["open"] as const),
    hasImage: normalizeEnum(raw.hasImage, ["with-image"] as const),
  };
}

function hasStructuredFilters(filters: SearchFilters): boolean {
  return (
    filters.category !== "" ||
    filters.location !== "" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== "" ||
    filters.status !== "" ||
    filters.format !== "" ||
    filters.approvalMode !== "" ||
    filters.availability !== "" ||
    filters.hasImage !== ""
  );
}

function buildSummary(filters: SearchFilters): string {
  const bits: string[] = [];
  if (filters.category) bits.push(`category ${filters.category}`);
  if (filters.location) bits.push(`location ${filters.location}`);
  if (filters.dateFrom) bits.push(`from ${filters.dateFrom}`);
  if (filters.dateTo) bits.push(`to ${filters.dateTo}`);
  if (filters.status) bits.push(`status ${filters.status}`);
  if (filters.format) bits.push(`format ${filters.format.replace("_", " ")}`);
  if (filters.availability) bits.push("open seats only");
  if (filters.hasImage) bits.push("with images");
  if (filters.keyword) bits.push(`keyword "${filters.keyword}"`);

  if (bits.length === 0) {
    return "No strict filters detected, keeping results broad.";
  }
  return `Mapped to ${bits.join(", ")}.`;
}

export async function POST(req: NextRequest) {
  try {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) {
      return NextResponse.json({ error: "Missing OPENROUTER_API_KEY in environment." }, { status: 500 });
    }

    const body = (await req.json()) as { prompt?: unknown };
    const prompt = asTrimmed(body.prompt, 500);
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    const model = process.env.OPENROUTER_EVENT_SEARCH_MODEL || "openai/gpt-4o-mini";
    const today = new Date().toISOString().slice(0, 10);
    const systemPrompt = [
      "You map natural language event search requests into Arkiv filters.",
      "Return ONLY valid JSON object with keys:",
      "keyword, category, location, dateFrom, dateTo, status, format, approvalMode, availability, hasImage",
      `Allowed category values: ${CATEGORY_LIST.join(", ")}`,
      "Allowed status: \"\", \"upcoming\", \"live\"",
      "Allowed format: \"\", \"in_person\", \"online\", \"hybrid\"",
      "Allowed approvalMode: \"\", \"auto\", \"manual\"",
      "Allowed availability: \"\", \"open\"",
      "Allowed hasImage: \"\", \"with-image\"",
      "Dates must be YYYY-MM-DD (e.g. 2026-03-07) or empty string.",
      "Use location as a plain city or venue text.",
      "Use keyword for leftover topic words not captured by structured fields.",
      "If a value is unknown, set empty string.",
      "Never output markdown, explanation, or extra keys.",
    ].join("\n");

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `today=${today}\nquery=${prompt}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("[ai-event-search] OpenRouter error:", response.status, err);
      return NextResponse.json(
        { error: `AI mapping failed (${response.status}).` },
        { status: response.status },
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = extractMessageContent(data?.choices?.[0]?.message?.content);
    const parsed = parseJsonObject(content);
    if (!parsed) {
      console.error("[ai-event-search] Invalid JSON response:", content);
      return NextResponse.json({ error: "AI returned invalid mapping JSON." }, { status: 502 });
    }

    const filters = normalizeFilters(parsed);
    if (!hasStructuredFilters(filters) && !filters.keyword) {
      filters.keyword = prompt.slice(0, 160);
    }

    return NextResponse.json({
      filters,
      summary: buildSummary(filters),
      model,
    });
  } catch (error) {
    console.error("[ai-event-search]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to map search request." },
      { status: 500 },
    );
  }
}
