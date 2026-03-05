import { jsonToPayload } from "@arkiv-network/sdk"
import { eq, gte, lte } from "@arkiv-network/sdk/query"
import { ExpirationTime } from "@arkiv-network/sdk/utils"
import type { Account, Chain, Hex, Transport } from "viem"
import type {
  Entity,
  PublicArkivClient,
  WalletArkivClient,
} from "@arkiv-network/sdk"
import { ENTITY_TYPES } from "../constants"
import type { ArkivResult, Event, EventStatus } from "../types"

const CONTENT_TYPE = "application/json" as const

const MIN_EXPIRY_SECONDS = ExpirationTime.fromDays(1)

// Compute seconds from now until isoDate + 30-day grace period without relying
// on ExpirationTime.fromDate, which can return a fractional number that the SDK
// fails to convert to BigInt.
// Result is always rounded DOWN to a multiple of 2 (BLOCK_TIME) so that
// `expiresIn / BLOCK_TIME` is an integer when the SDK converts to blocks.
function secondsUntil(isoDate: string): number {
  const diffMs = new Date(isoDate).getTime() - Date.now()
  // Add 30-day grace period after end date so event data remains queryable
  const gracePeriod = ExpirationTime.fromDays(30)
  const seconds = Math.floor(Math.max(diffMs / 1_000 + gracePeriod, MIN_EXPIRY_SECONDS))
  return Math.floor(seconds / 2) * 2
}

function toUnixSeconds(isoDate: string): number {
  return Math.floor(new Date(isoDate).getTime() / 1_000)
}

export async function createEventEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  data: Event,
  organizerKey?: Hex,
  organizerName?: string,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const result = await walletClient.createEntity({
      payload: jsonToPayload(data),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.EVENT },
        { key: "title", value: data.title },
        { key: "status", value: data.status ?? "upcoming" },
        { key: "category", value: data.category },
        { key: "location", value: data.location },
        { key: "date", value: toUnixSeconds(data.date) },
        { key: "organizer", value: walletClient.account.address },
        { key: "capacity", value: data.capacity },
        { key: "rsvpCount", value: 0 },
        { key: "requiresRsvp", value: data.requiresRsvp ? 1 : 0 },
        { key: "isOnline", value: data.virtualLink ? 1 : 0 },
        // entity relationship: reference to the organizer_profile entity
        { key: "organizerKey", value: organizerKey ?? "" },
        { key: "organizerName", value: organizerName ?? "" },
      ],
      
      expiresIn: secondsUntil(data.endDate),
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateEventStatus(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  newStatus: EventStatus,
  currentPayload: Event,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const updated: Event = { ...currentPayload, status: newStatus }

    
    const entity = await publicClient.getEntity(entityKey)
    const rsvpAttr = entity.attributes.find((a) => a.key === "rsvpCount")
    const rsvpCount = Number(rsvpAttr?.value ?? 0)

    // preserve optional entity-reference attributes
    const existingOrgKey = entity.attributes.find((a) => a.key === "organizerKey")?.value as Hex | undefined
    const existingOrgName = entity.attributes.find((a) => a.key === "organizerName")?.value as string | undefined
    const existingRequiresRsvp = Number(entity.attributes.find((a) => a.key === "requiresRsvp")?.value ?? 0)

    const result = await walletClient.updateEntity({
      entityKey,
      payload: jsonToPayload(updated),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.EVENT },
        { key: "title", value: currentPayload.title },
        { key: "status", value: newStatus },
        { key: "category", value: currentPayload.category },
        { key: "location", value: currentPayload.location },
        { key: "date", value: toUnixSeconds(currentPayload.date) },
        { key: "organizer", value: walletClient.account.address },
        { key: "capacity", value: currentPayload.capacity },
        { key: "rsvpCount", value: rsvpCount },
        { key: "requiresRsvp", value: existingRequiresRsvp },
        { key: "isOnline", value: currentPayload.virtualLink ? 1 : 0 },
        { key: "organizerKey", value: existingOrgKey ?? "" },
        { key: "organizerName", value: existingOrgName ?? "" },
      ],
      expiresIn: secondsUntil(currentPayload.endDate),
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateEventDetails(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  updatedData: Event,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    
    const entity = await publicClient.getEntity(entityKey)
    const rsvpAttr = entity.attributes.find((a) => a.key === "rsvpCount")
    const rsvpCount = Number(rsvpAttr?.value ?? 0)

    // preserve entity-reference attributes
    const existingOrgKey = entity.attributes.find((a) => a.key === "organizerKey")?.value as Hex | undefined
    const existingOrgName = entity.attributes.find((a) => a.key === "organizerName")?.value as string | undefined

    const result = await walletClient.updateEntity({
      entityKey,
      payload: jsonToPayload(updatedData),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.EVENT },
        { key: "title", value: updatedData.title },
        { key: "status", value: updatedData.status },
        { key: "category", value: updatedData.category },
        { key: "location", value: updatedData.location },
        { key: "date", value: toUnixSeconds(updatedData.date) },
        { key: "organizer", value: walletClient.account.address },
        { key: "capacity", value: updatedData.capacity },
        { key: "rsvpCount", value: rsvpCount },
        { key: "requiresRsvp", value: updatedData.requiresRsvp ? 1 : 0 },
        { key: "isOnline", value: updatedData.virtualLink ? 1 : 0 },
        { key: "organizerKey", value: existingOrgKey ?? "" },
        { key: "organizerName", value: existingOrgName ?? "" },
      ],
      expiresIn: secondsUntil(updatedData.endDate),
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Updates the rsvpCount attribute on the event entity by deriving the real count
 * from actual RSVP child entities (source-of-truth approach).
 *
 * The old read-increment-write pattern had a TOCTOU race: two simultaneous RSVPs
 * could both read rsvpCount=N and both write N+1, silently losing one increment
 * and corrupting capacity enforcement. By querying the live RSVP entity set and
 * counting them, concurrent writes all converge to the same correct value instead
 * of diverging. The `_increment` parameter is retained for API compatibility.
 */
export async function updateRsvpCount(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  _increment: boolean,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    // Fetch the event entity and all its RSVP children in parallel
    const [entity, rsvpResult] = await Promise.all([
      publicClient.getEntity(entityKey),
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.RSVP),
          eq("eventKey", entityKey),
        ])
        .withAttributes()
        .fetch(),
    ])

    // Count only active RSVPs — exclude "not-going" (cancelled) entries
    const actualCount = rsvpResult.entities.filter((e) => {
      const status = e.attributes.find((a) => a.key === "status")?.value
      return status !== "not-going"
    }).length

    const attrs = entity.attributes.map((a) =>
      a.key === "rsvpCount" ? { key: "rsvpCount", value: actualCount } : a,
    )

    const eventData = entity.toJson() as Event
    const expiresIn = secondsUntil(eventData.endDate)

    const result = await walletClient.updateEntity({
      entityKey,
      payload: entity.payload ?? jsonToPayload(eventData),
      contentType: CONTENT_TYPE,
      attributes: attrs,
      expiresIn,
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Cascade-deletes the event entity and all organizer-owned child entities
 * (approvals, rejections, checkins) in a single mutateEntities call.
 *
 * NOTE (Pattern C): Attendee-owned RSVPs cannot be deleted by the organizer
 * due to on-chain ownership. These will expire naturally per their TTL.
 */
export async function deleteEvent(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<{ txHash: Hex; deletedCount: number }>> {
  try {
    // Query all child entities for this event in parallel
    const [approvalResult, rejectionResult, checkinResult] = await Promise.all([
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.RSVP_APPROVAL),
          eq("eventKey", eventKey),
        ])
        .withAttributes()
        .fetch(),
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.RSVP_REJECTION),
          eq("eventKey", eventKey),
        ])
        .withAttributes()
        .fetch(),
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.CHECKIN),
          eq("eventKey", eventKey),
        ])
        .withAttributes()
        .fetch(),
    ])

    // Also query PoA entities if they exist
    let poaEntities: { key: string | import("viem").Hex }[] = []
    try {
      const poaResult = await publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.PROOF_OF_ATTENDANCE),
          eq("eventKey", eventKey),
        ])
        .withAttributes()
        .fetch()
      poaEntities = poaResult.entities
    } catch {
      // PoA entity type may not exist yet — ignore
    }

    // Build cascade delete: event + all organizer-owned children
    const deletes = [
      { entityKey: eventKey },
      ...approvalResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...rejectionResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...checkinResult.entities.map((e) => ({ entityKey: e.key as Hex })),
      ...poaEntities.map((e) => ({ entityKey: e.key as Hex })),
    ]

    const result = await walletClient.mutateEntities({ deletes })

    return {
      success: true,
      data: {
        txHash: result.txHash as Hex,
        deletedCount: deletes.length,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
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

export interface EventFilters {
  
  category?: string
  
  location?: string
  
  dateFrom?: number
  
  dateTo?: number
  
  status?: EventStatus
}

export async function getAllUpcomingEvents(
  publicClient: PublicArkivClient,
  filters?: EventFilters,
): Promise<ArkivResult<Entity[]>> {
  try {
    // When a specific status filter is requested, use it directly
    if (filters?.status) {
      const predicates = [
        eq("type", ENTITY_TYPES.EVENT),
        eq("status", filters.status),
        ...(filters?.category ? [eq("category", filters.category)] : []),
        ...(filters?.location ? [eq("location", filters.location)] : []),
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
    }

    // Default: show both "upcoming" and "live" events so full-capacity events
    // (auto-promoted to "live") are still discoverable for waitlisting
    const [upcomingResult, liveResult] = await Promise.all([
      publicClient
        .buildQuery()
        .where([
          eq("type", ENTITY_TYPES.EVENT),
          eq("status", "upcoming"),
          ...(filters?.category ? [eq("category", filters.category)] : []),
          ...(filters?.location ? [eq("location", filters.location)] : []),
          ...(filters?.dateFrom ? [gte("date", filters.dateFrom)] : []),
          ...(filters?.dateTo ? [lte("date", filters.dateTo)] : []),
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
          ...(filters?.category ? [eq("category", filters.category)] : []),
          ...(filters?.location ? [eq("location", filters.location)] : []),
          ...(filters?.dateFrom ? [gte("date", filters.dateFrom)] : []),
          ...(filters?.dateTo ? [lte("date", filters.dateTo)] : []),
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

export async function autoTransitionEndedEvents(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  walletAddress: Hex,
): Promise<ArkivResult<{ transitioned: number }>> {
  try {
    const nowSeconds = Math.floor(Date.now() / 1_000)

    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.EVENT)])
      .ownedBy(walletAddress)
      .withPayload()
      .withAttributes()
      .fetch()

    const toEnd = result.entities.filter((ent) => {
      const statusAttr = ent.attributes.find((a) => a.key === "status")
      const status = statusAttr?.value as string
      if (status === "ended" || status === "draft") return false

      const data = ent.toJson() as Event
      const endMs = Date.parse(data.endDate)
      if (isNaN(endMs)) return false
      return Math.floor(endMs / 1_000) < nowSeconds
    })

    if (toEnd.length === 0) return { success: true, data: { transitioned: 0 } }

    const updates = toEnd.map((ent) => {
      const data = ent.toJson() as Event
      const updatedData: Event = { ...data, status: "ended" }
      const attrs = ent.attributes.map((a) =>
        a.key === "status" ? { key: "status", value: "ended" } : a,
      )
      return {
        entityKey: ent.key as Hex,
        payload: jsonToPayload(updatedData),
        contentType: "application/json" as const,
        attributes: attrs,
        expiresIn: Math.floor(ExpirationTime.fromDays(7)),
      }
    })

    await walletClient.mutateEntities({ updates })

    return { success: true, data: { transitioned: toEnd.length } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function autoPromoteCapacityStatus(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<{ promoted: boolean }>> {
  try {
    const entity = await publicClient.getEntity(eventKey)
    const data = entity.toJson() as Event

    const capacityAttr = entity.attributes.find((a) => a.key === "capacity")
    const rsvpAttr = entity.attributes.find((a) => a.key === "rsvpCount")
    const capacity = Number(capacityAttr?.value ?? 0)
    const rsvpCount = Number(rsvpAttr?.value ?? 0)

    if (capacity === 0) return { success: true, data: { promoted: false } }

    const newStatus: EventStatus = rsvpCount >= capacity ? "live" : "upcoming"
    const currentStatusAttr = entity.attributes.find((a) => a.key === "status")
    const currentStatus = currentStatusAttr?.value as string

    if (currentStatus === newStatus || currentStatus === "ended" || currentStatus === "draft") {
      return { success: true, data: { promoted: false } }
    }

    const attrs = entity.attributes.map((a) =>
      a.key === "status" ? { key: "status", value: newStatus } : a,
    )

    await walletClient.updateEntity({
      entityKey: eventKey,
      payload: jsonToPayload({ ...data, status: newStatus }),
      contentType: "application/json" as const,
      attributes: attrs,
      expiresIn: secondsUntil(data.endDate),
    })

    return { success: true, data: { promoted: true } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

