import { eq, gte, lte } from "@arkiv-network/sdk/query"
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk"
import type { Hex } from "viem"
import { ENTITY_TYPES } from "../constants"
import type { ArkivResult, EventStatus } from "../types"

export interface EventFilters {

  category?: string

  location?: string

  dateFrom?: number

  dateTo?: number

  status?: EventStatus

  isOnline?: number
}

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

export async function getAllUpcomingEvents(
  publicClient: PublicArkivClient,
  filters?: EventFilters,
): Promise<ArkivResult<Entity[]>> {
  try {

    if (filters?.status) {
      return getEventsMultiFilter(publicClient, filters)
    }

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

export async function getEventsByCategoryAndStatus(
  publicClient: PublicArkivClient,
  category: string,
  status: EventStatus,
): Promise<ArkivResult<Entity[]>> {
  return getEventsMultiFilter(publicClient, { category, status })
}

export async function getOnlineEvents(
  publicClient: PublicArkivClient,
): Promise<ArkivResult<Entity[]>> {
  return getEventsMultiFilter(publicClient, { isOnline: 1 })
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
