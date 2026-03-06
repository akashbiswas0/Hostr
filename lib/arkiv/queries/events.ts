import { and, eq, gte, lte, or } from "@arkiv-network/sdk/query";
import type { Predicate } from "@arkiv-network/sdk/query";
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { ENTITY_TYPES } from "../constants";
import type {
  ArkivResult,
  Event,
  EventDiscoveryFiltersV2,
  EventGraphV2,
  EventSortV2,
  EventStatus,
} from "../types";
import { normalizeText, tokenizeSearch, unixNow } from "../v2";

export interface EventFilters {
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

function mergeFilters(filters?: EventFilters): EventDiscoveryFiltersV2 {
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

function predicatesForFilters(filters?: EventDiscoveryFiltersV2) {
  const predicates: Predicate[] = [eq("type", ENTITY_TYPES.EVENT)];

  if (filters?.status?.length) {
    if (filters.status.length === 1) predicates.push(eq("status", filters.status[0]));
    else predicates.push(or(filters.status.map((status) => eq("status", status))));
  }

  if (filters?.category?.length) {
    if (filters.category.length === 1) {
      predicates.push(eq("category", filters.category[0]));
    } else {
      predicates.push(or(filters.category.map((category) => eq("category", category))));
    }
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

  return predicates;
}

function sortQuery(
  query: ReturnType<PublicArkivClient["buildQuery"]>,
  sort: EventSortV2,
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

export async function discoverEventsV2(
  publicClient: PublicArkivClient,
  filters?: EventDiscoveryFiltersV2,
  sort: EventSortV2 = "startAtAsc",
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

    const entities = filters?.hasSeatsOnly
      ? result.entities.filter((entity) => {
          const seats = Number(
            entity.attributes.find((a) => a.key === "seatsRemaining")?.value ?? 0,
          );
          return seats > 0;
        })
      : result.entities;

    return {
      success: true,
      data: { entities, cursor: result.cursor },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function searchEventsByKeywordV2(
  publicClient: PublicArkivClient,
  tokens: string[],
  filters?: EventDiscoveryFiltersV2,
  sort: EventSortV2 = "startAtAsc",
): Promise<ArkivResult<Entity[]>> {
  try {
    const cleaned = Array.from(new Set(tokens.map(normalizeText).filter(Boolean)));
    if (cleaned.length === 0) {
      const discover = await discoverEventsV2(publicClient, filters, sort);
      if (!discover.success) return { success: false, error: discover.error };
      return { success: true, data: discover.data.entities };
    }

    const tokenQueries = await Promise.all(
      cleaned.map((token) =>
        publicClient
          .buildQuery()
          .where([
            eq("type", ENTITY_TYPES.EVENT_SEARCH_TOKEN),
            eq("token", token),
          ])
          .withAttributes()
          .fetch(),
      ),
    );

    const score = new Map<string, number>();
    for (const query of tokenQueries) {
      for (const tokenEntity of query.entities) {
        const eventKey = String(
          tokenEntity.attributes.find((a) => a.key === "eventKey")?.value ?? "",
        );
        if (!eventKey) continue;
        score.set(eventKey, (score.get(eventKey) ?? 0) + 1);
      }
    }

    const rankedKeys = Array.from(score.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key as Hex);

    if (rankedKeys.length === 0) return { success: true, data: [] };

    const discover = await discoverEventsV2(publicClient, filters, sort, undefined, 200);
    if (!discover.success) return { success: false, error: discover.error };

    const discoverMap = new Map(
      discover.data.entities.map((entity) => [String(entity.key).toLowerCase(), entity]),
    );

    const hydrated: Entity[] = [];
    for (const key of rankedKeys) {
      const match = discoverMap.get(String(key).toLowerCase());
      if (match) hydrated.push(match);
    }

    return { success: true, data: hydrated };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getEventsMultiFilter(
  publicClient: PublicArkivClient,
  filters?: EventFilters,
): Promise<ArkivResult<Entity[]>> {
  if (filters?.keyword?.trim()) {
    return searchEventsByKeywordV2(
      publicClient,
      tokenizeSearch(filters.keyword),
      mergeFilters(filters),
      "startAtAsc",
    );
  }

  const result = await discoverEventsV2(
    publicClient,
    mergeFilters(filters),
    "startAtAsc",
  );

  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data.entities };
}

export async function getAllUpcomingEvents(
  publicClient: PublicArkivClient,
  filters?: EventFilters,
): Promise<ArkivResult<Entity[]>> {
  const nextFilters = mergeFilters(filters);

  if (!filters?.status) {
    nextFilters.status = ["upcoming", "live"];
  }

  if (filters?.keyword?.trim()) {
    return searchEventsByKeywordV2(
      publicClient,
      tokenizeSearch(filters.keyword),
      nextFilters,
      "startAtAsc",
    );
  }

  const result = await discoverEventsV2(publicClient, nextFilters, "startAtAsc");
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data.entities };
}

export async function getEventsByCategoryAndStatus(
  publicClient: PublicArkivClient,
  category: string,
  status: EventStatus,
): Promise<ArkivResult<Entity[]>> {
  return getEventsMultiFilter(publicClient, { category, status });
}

export async function getOnlineEvents(
  publicClient: PublicArkivClient,
): Promise<ArkivResult<Entity[]>> {
  return getEventsMultiFilter(publicClient, { isOnline: 1 });
}

export async function getEventsByOrganizer(
  publicClient: PublicArkivClient,
  walletAddress: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.EVENT)])
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

export async function getEventGraphV2(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<EventGraphV2>> {
  try {
    const [event, rsvps, decisions, checkins, poaps] = await Promise.all([
      publicClient.getEntity(eventKey),
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.RSVP),
          eq("eventKey", eventKey),
        ])
        .withPayload()
        .withAttributes()
        .fetch(),
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.RSVP_DECISION),
          eq("eventKey", eventKey),
        ])
        .withPayload()
        .withAttributes()
        .fetch(),
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.CHECKIN),
          eq("eventKey", eventKey),
        ])
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
        rsvps: rsvps.entities,
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

export async function getOrganizerPipelineV2(
  publicClient: PublicArkivClient,
  organizerWallet: Hex,
  filters?: { status?: EventStatus[]; startFrom?: number; startTo?: number },
): Promise<ArkivResult<Entity[]>> {
  try {
    const basePredicates: Predicate[] = [eq("type", ENTITY_TYPES.EVENT)];
    if (filters?.status?.length) {
      basePredicates.push(
        filters.status.length === 1
          ? eq("status", filters.status[0])
          : or(filters.status.map((status) => eq("status", status))),
      );
    }
    if (filters?.startFrom) basePredicates.push(gte("startAt", filters.startFrom));
    if (filters?.startTo) basePredicates.push(lte("startAt", filters.startTo));

    const result = await publicClient
      .buildQuery()
      .where(and(basePredicates))
      .ownedBy(organizerWallet)
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

export async function getMyUpcomingScheduleV2(
  publicClient: PublicArkivClient,
  attendeeWallet: Hex,
  range?: { startFrom?: number; startTo?: number },
): Promise<ArkivResult<Entity[]>> {
  try {
    const rsvps = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.RSVP)])
      .ownedBy(attendeeWallet)
      .withAttributes()
      .fetch();

    const active = rsvps.entities.filter((entity) => {
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

    const events = await Promise.all(
      eventKeys.map((eventKey) => publicClient.getEntity(eventKey)),
    );

    const now = unixNow();
    const filtered = events.filter((entity) => {
      const startAt = Number(
        entity.attributes.find((a) => a.key === "startAt")?.value ??
          entity.attributes.find((a) => a.key === "date")?.value ??
          0,
      );
      if (startAt < now) return false;
      if (range?.startFrom && startAt < range.startFrom) return false;
      if (range?.startTo && startAt > range.startTo) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const av = Number(a.attributes.find((attr) => attr.key === "startAt")?.value ?? 0);
      const bv = Number(b.attributes.find((attr) => attr.key === "startAt")?.value ?? 0);
      return av - bv;
    });

    return { success: true, data: filtered };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function countEventsByFacetV2(
  publicClient: PublicArkivClient,
  baseFilters: EventDiscoveryFiltersV2,
  facet: "category" | "cityNorm" | "priceTier" | "format",
): Promise<ArkivResult<Array<{ value: string; count: number }>>> {
  try {
    const result = await discoverEventsV2(publicClient, baseFilters, "startAtAsc", undefined, 500);
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
