import { and, eq, gte, lte, or } from "@arkiv-network/sdk/query";
import type { Predicate } from "@arkiv-network/sdk/query";
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { ENTITY_TYPES } from "../constants";
import type {
  ArkivResult,
  Event,
  EventStatus,
  HostEventDiscoveryFilters,
  HostEventGraph,
  HostEventSort,
} from "../types";
import { normalizeText, tokenizeSearch, unixNow } from "../v2";

export interface HostEventFilters {
  category?: string;
  location?: string;
  dateFrom?: number;
  dateTo?: number;
  status?: EventStatus;
  isOnline?: number;
  keyword?: string;
  approvalMode?: "auto" | "manual";
  hasImage?: 0 | 1;
  hasSeatsOnly?: boolean;
  format?: "in_person" | "online" | "hybrid";
}

function mergeFilters(filters?: HostEventFilters): HostEventDiscoveryFilters {
  return {
    category: filters?.category ? [filters.category] : undefined,
    city: filters?.location,
    startFrom: filters?.dateFrom,
    startTo: filters?.dateTo,
    status: filters?.status ? [filters.status] : undefined,
    isOnline:
      filters?.isOnline === undefined
        ? undefined
        : filters.isOnline === 1
          ? 1
          : 0,
    approvalMode: filters?.approvalMode,
    hasImage: filters?.hasImage,
    hasSeatsOnly: filters?.hasSeatsOnly,
    format: filters?.format,
  };
}

function predicatesForFilters(filters?: HostEventDiscoveryFilters): Predicate[] {
  const predicates: Predicate[] = [eq("type", ENTITY_TYPES.HOSTEVENT)];

  if (filters?.status?.length) {
    predicates.push(
      filters.status.length === 1
        ? eq("status", filters.status[0])
        : or(filters.status.map((status) => eq("status", status))),
    );
  } else {
    predicates.push(or([eq("status", "upcoming"), eq("status", "live"), eq("status", "ended")]));
  }

  if (filters?.category?.length) {
    predicates.push(
      filters.category.length === 1
        ? eq("category", filters.category[0])
        : or(filters.category.map((category) => eq("category", category))),
    );
  }

  if (filters?.city) predicates.push(eq("cityNorm", normalizeText(filters.city)));
  if (filters?.countryCode) predicates.push(eq("countryCode", filters.countryCode.toUpperCase()));
  if (filters?.format) predicates.push(eq("format", filters.format));
  if (filters?.isOnline !== undefined) predicates.push(eq("isOnline", filters.isOnline));
  if (filters?.approvalMode) predicates.push(eq("approvalMode", filters.approvalMode));
  if (filters?.priceTier) predicates.push(eq("priceTier", filters.priceTier));
  if (filters?.language) predicates.push(eq("language", normalizeText(filters.language)));
  if (filters?.hasImage !== undefined) predicates.push(eq("hasImage", filters.hasImage));
  if (filters?.startFrom) predicates.push(gte("startAt", filters.startFrom));
  if (filters?.startTo) predicates.push(lte("startAt", filters.startTo));
  if (filters?.hasSeatsOnly) predicates.push(gte("seatsRemaining", 1));

  return predicates;
}

function sortQuery(
  query: ReturnType<PublicArkivClient["buildQuery"]>,
  sort: HostEventSort,
) {
  if (sort === "startAtDesc") return query.orderBy("startAt", "number", "desc");
  if (sort === "newest") return query.orderBy("createdAt", "number", "desc");
  if (sort === "mostPopular") return query.orderBy("rsvpConfirmedCount", "number", "desc");
  return query.orderBy("startAt", "number", "asc");
}

export async function getEventByKey(
  publicClient: PublicArkivClient,
  entityKey: Hex,
): Promise<ArkivResult<Entity>> {
  try {
    const entity = await publicClient.getEntity(entityKey);
    return { success: true, data: entity };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function discoverHostEvents(
  publicClient: PublicArkivClient,
  filters?: HostEventDiscoveryFilters,
  sort: HostEventSort = "startAtAsc",
  cursor?: string,
  limit = 50,
): Promise<ArkivResult<{ entities: Entity[]; cursor?: string }>> {
  try {
    let query = publicClient
      .buildQuery()
      .where(predicatesForFilters(filters))
      .withPayload()
      .withAttributes()
      .limit(limit);

    query = sortQuery(query, sort);
    if (cursor) query = query.cursor(cursor);
    const result = await query.fetch();

    return {
      success: true,
      data: {
        entities: result.entities,
        cursor: result.cursor,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const TOKEN_WEIGHTS: Record<string, number> = {
  title: 5,
  venue: 3,
  tags: 2,
  description: 1,
};

export async function searchHostEventsByKeyword(
  publicClient: PublicArkivClient,
  tokens: string[],
  filters?: HostEventDiscoveryFilters,
  sort: HostEventSort = "startAtAsc",
): Promise<ArkivResult<Entity[]>> {
  try {
    const cleaned = Array.from(new Set(tokens.map(normalizeText).filter(Boolean)));
    if (cleaned.length === 0) {
      const discover = await discoverHostEvents(publicClient, filters, sort);
      if (!discover.success) return { success: false, error: discover.error };
      return { success: true, data: discover.data.entities };
    }

    const tokenQueries = await Promise.all(
      cleaned.map((token) =>
        publicClient
          .buildQuery()
          .where([eq("type", ENTITY_TYPES.EVENT_SEARCH_TOKEN), eq("token", token)])
          .withAttributes()
          .fetch(),
      ),
    );

    const scored = new Map<string, number>();
    for (const query of tokenQueries) {
      for (const tokenEntity of query.entities) {
        const eventKey = String(
          tokenEntity.attributes.find((a) => a.key === "eventKey")?.value ?? "",
        );
        if (!eventKey) continue;
        const field = String(
          tokenEntity.attributes.find((a) => a.key === "field")?.value ?? "tags",
        );
        const weight = TOKEN_WEIGHTS[field] ?? 1;
        scored.set(eventKey, (scored.get(eventKey) ?? 0) + weight);
      }
    }

    const rankedKeys = Array.from(scored.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key.toLowerCase());

    if (rankedKeys.length === 0) return { success: true, data: [] };

    const discover = await discoverHostEvents(publicClient, filters, sort, undefined, 300);
    if (!discover.success) return { success: false, error: discover.error };

    const discoverMap = new Map(
      discover.data.entities.map((entity) => [String(entity.key).toLowerCase(), entity]),
    );
    return {
      success: true,
      data: rankedKeys
        .map((key) => discoverMap.get(key))
        .filter((entity): entity is Entity => Boolean(entity)),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getHostEventGraph(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<HostEventGraph>> {
  try {
    const [event, tickets, decisions, checkins, poaps] = await Promise.all([
      publicClient.getEntity(eventKey),
      publicClient
        .buildQuery()
        .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey)])
        .withPayload()
        .withAttributes()
        .fetch(),
      publicClient
        .buildQuery()
        .where([eq("type", ENTITY_TYPES.TICKET_DECISION), eq("eventKey", eventKey)])
        .withPayload()
        .withAttributes()
        .fetch(),
      publicClient
        .buildQuery()
        .where([eq("type", ENTITY_TYPES.CHECKIN), eq("eventKey", eventKey)])
        .withPayload()
        .withAttributes()
        .fetch(),
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.PROOF_OF_ATTENDANCE),
          eq("eventKey", eventKey),
        ])
        .withPayload()
        .withAttributes()
        .fetch(),
    ]);

    return {
      success: true,
      data: {
        event,
        tickets: tickets.entities,
        decisions: decisions.entities,
        checkins: checkins.entities,
        poaps: poaps.entities,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getHostEventsByOrganizer(
  publicClient: PublicArkivClient,
  walletAddress: Hex,
  includeArchived = true,
): Promise<ArkivResult<Entity[]>> {
  try {
    const predicates: Predicate[] = [eq("type", ENTITY_TYPES.HOSTEVENT)];
    if (!includeArchived) predicates.push(or([eq("status", "draft"), eq("status", "upcoming"), eq("status", "live"), eq("status", "ended")]));

    const result = await publicClient
      .buildQuery()
      .where(and(predicates))
      .ownedBy(walletAddress)
      .withPayload()
      .withAttributes()
      .orderBy("startAt", "number", "asc")
      .fetch();

    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getAllUpcomingEvents(
  publicClient: PublicArkivClient,
  filters?: HostEventFilters,
): Promise<ArkivResult<Entity[]>> {
  const merged = mergeFilters(filters);
  if (!filters?.status) merged.status = ["upcoming", "live"];

  if (filters?.keyword?.trim()) {
    return searchHostEventsByKeyword(
      publicClient,
      tokenizeSearch(filters.keyword),
      merged,
      "startAtAsc",
    );
  }

  const result = await discoverHostEvents(publicClient, merged, "startAtAsc");
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data.entities };
}

export async function getHostEventScheduleForAttendee(
  publicClient: PublicArkivClient,
  attendeeWallet: Hex,
  range?: { startFrom?: number; startTo?: number },
): Promise<ArkivResult<Entity[]>> {
  try {
    const ticketResult = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET)])
      .ownedBy(attendeeWallet)
      .withAttributes()
      .fetch();

    const active = ticketResult.entities.filter((entity) => {
      const status = String(
        entity.attributes.find((a) => a.key === "status")?.value ?? "pending",
      );
      return status !== "not-going";
    });

    const eventKeys = Array.from(
      new Set(
        active
          .map((entity) => String(entity.attributes.find((a) => a.key === "eventKey")?.value ?? ""))
          .filter(Boolean),
      ),
    ) as Hex[];

    const events = await Promise.all(eventKeys.map((eventKey) => publicClient.getEntity(eventKey)));
    const now = unixNow();

    const filtered = events.filter((entity) => {
      const status = String(entity.attributes.find((a) => a.key === "status")?.value ?? "");
      if (status === "archived") return false;
      const startAt = Number(entity.attributes.find((a) => a.key === "startAt")?.value ?? 0);
      if (startAt < now) return false;
      if (range?.startFrom && startAt < range.startFrom) return false;
      if (range?.startTo && startAt > range.startTo) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const aValue = Number(a.attributes.find((attr) => attr.key === "startAt")?.value ?? 0);
      const bValue = Number(b.attributes.find((attr) => attr.key === "startAt")?.value ?? 0);
      return aValue - bValue;
    });

    return { success: true, data: filtered };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function countHostEventsByFacet(
  publicClient: PublicArkivClient,
  filters: HostEventDiscoveryFilters,
  facet: "category" | "cityNorm" | "priceTier" | "format",
): Promise<ArkivResult<Array<{ value: string; count: number }>>> {
  try {
    const result = await discoverHostEvents(publicClient, filters, "startAtAsc", undefined, 500);
    if (!result.success) return { success: false, error: result.error };

    const counts = new Map<string, number>();
    for (const entity of result.data.entities) {
      const value = String(entity.attributes.find((a) => a.key === facet)?.value ?? "").trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return {
      success: true,
      data: Array.from(counts.entries()).map(([value, count]) => ({ value, count })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function eventEntityToPayload(entity: Entity): Event {
  return entity.toJson() as Event;
}
