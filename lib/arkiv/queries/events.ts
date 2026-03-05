/**
 * Event query functions — read-only Arkiv queries.
 * All filtering, sorting, and multi-predicate composition lives here.
 */

import { eq, gte, lte } from "@arkiv-network/sdk/query"
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk"
import type { Hex } from "viem"
import { ENTITY_TYPES } from "../constants"
import type { ArkivResult, EventStatus } from "../types"

// ─── Filter types ────────────────────────────────────────────────────────────

export interface EventFilters {
  /** Exact-match category */
  category?: string
  /** Exact-match location (use client-side substring for fuzzy) */
  location?: string
  /** Unix seconds lower-bound for event date */
  dateFrom?: number
  /** Unix seconds upper-bound for event date */
  dateTo?: number
  /** Exact-match status */
  status?: EventStatus
  /** Filter online-only events (1 = online, 0 = offline) */
  isOnline?: number
}

// ─── Single entity ───────────────────────────────────────────────────────────

export async function getEventByKey(
  publicClient: PublicArkivClient,
  entityKey: Hex,
): Promise<ArkivResult<Entity>> {
  try {
    const entity = await publicClient.getEntity(entityKey)
    return { success: true, data: entity }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ─── Multi-filter query ──────────────────────────────────────────────────────

/**
 * Compose all supplied filters into Arkiv-level predicates.
 * Always sorts by `date` ascending.
 */
export async function getEventsMultiFilter(
  publicClient: PublicArkivClient,
  filters?: EventFilters,
): Promise<ArkivResult<Entity[]>> {
  try {
    const predicates = [
      eq("type", ENTITY_TYPES.EVENT),
      ...(filters?.status ? [eq("status", filters.status)] : []),
      ...(filters?.category ? [eq("category", filters.category)] : []),
      ...(filters?.location ? [eq("location", filters.location)] : []),
      ...(filters?.isOnline !== undefined ? [eq("isOnline", filters.isOnline)] : []),
      ...(filters?.dateFrom ? [gte("date", filters.dateFrom)] : []),
      ...(filters?.dateTo ? [lte("date", filters.dateTo)] : []),
    ]

    const result = await publicClient
      .buildQuery()
      .where(predicates)
      .withPayload()
      .withAttributes()
      .orderBy("date", "number", "asc")
      .fetch()

    return { success: true, data: result.entities }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ─── Upcoming + live (default browse) ────────────────────────────────────────

/**
 * Returns both "upcoming" and "live" events merged and sorted by date.
 * Accepts optional filters composed into Arkiv-level predicates.
 */
export async function getAllUpcomingEvents(
  publicClient: PublicArkivClient,
  filters?: EventFilters,
): Promise<ArkivResult<Entity[]>> {
  try {
    // When a specific status filter is requested, use it directly
    if (filters?.status) {
      return getEventsMultiFilter(publicClient, filters)
    }

    // Default: show both "upcoming" and "live" events
    const sharedPredicates = [
      ...(filters?.category ? [eq("category", filters.category)] : []),
      ...(filters?.location ? [eq("location", filters.location)] : []),
      ...(filters?.isOnline !== undefined ? [eq("isOnline", filters.isOnline)] : []),
      ...(filters?.dateFrom ? [gte("date", filters.dateFrom)] : []),
      ...(filters?.dateTo ? [lte("date", filters.dateTo)] : []),
    ]

    const [upcomingResult, liveResult] = await Promise.all([
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.EVENT),
          eq("status", "upcoming"),
          ...sharedPredicates,
        ])
        .withPayload()
        .withAttributes()
        .orderBy("date", "number", "asc")
        .fetch(),
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.EVENT),
          eq("status", "live"),
          ...sharedPredicates,
        ])
        .withPayload()
        .withAttributes()
        .orderBy("date", "number", "asc")
        .fetch(),
    ])

    // Merge and sort by date attribute
    const allEntities = [...upcomingResult.entities, ...liveResult.entities]
    allEntities.sort((a, b) => {
      const dateA = Number(a.attributes.find((attr) => attr.key === "date")?.value ?? 0)
      const dateB = Number(b.attributes.find((attr) => attr.key === "date")?.value ?? 0)
      return dateA - dateB
    })

    return { success: true, data: allEntities }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

// ─── Convenience queries ─────────────────────────────────────────────────────

/** Events filtered by category + status, sorted by date ascending. */
export async function getEventsByCategoryAndStatus(
  publicClient: PublicArkivClient,
  category: string,
  status: EventStatus,
): Promise<ArkivResult<Entity[]>> {
  return getEventsMultiFilter(publicClient, { category, status })
}

/** Online-only events, sorted by date ascending. */
export async function getOnlineEvents(
  publicClient: PublicArkivClient,
): Promise<ArkivResult<Entity[]>> {
  return getEventsMultiFilter(publicClient, { isOnline: 1 })
}

// ─── By organizer ────────────────────────────────────────────────────────────

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
      .orderBy("date", "number", "asc")
      .fetch()

    return { success: true, data: result.entities }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
