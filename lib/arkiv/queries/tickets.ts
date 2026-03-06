import { eq } from "@arkiv-network/sdk/query";
import type { Entity, PublicArkivClient } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { ENTITY_TYPES } from "../constants";
import type { ArkivResult, TicketDecision, TicketStatus } from "../types";

export async function getTicketsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey)])
      .withPayload()
      .withAttributes()
      .orderBy("requestedAt", "number", "asc")
      .fetch();

    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getTicketsByEventAndStatus(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  status: TicketStatus,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.TICKET),
        eq("eventKey", eventKey),
        eq("status", status),
      ])
      .withPayload()
      .withAttributes()
      .orderBy("requestedAt", "number", "asc")
      .fetch();
    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getTicketByAttendee(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  attendeeWallet: Hex,
): Promise<ArkivResult<Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey)])
      .ownedBy(attendeeWallet)
      .withPayload()
      .withAttributes()
      .fetch();

    const toPriority = (entity: Entity): number => {
      const status = String(entity.attributes.find((attr) => attr.key === "status")?.value ?? "pending");
      return status === "not-going" ? 0 : 1;
    };

    const toRequestedAt = (entity: Entity): number => {
      const raw = entity.attributes.find((attr) => attr.key === "requestedAt")?.value;
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
      const parsed = Number(raw ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const sorted = [...result.entities].sort((a, b) => {
      const byPriority = toPriority(b) - toPriority(a);
      if (byPriority !== 0) return byPriority;

      const byRequestedAt = toRequestedAt(b) - toRequestedAt(a);
      if (byRequestedAt !== 0) return byRequestedAt;

      return Number(b.createdAtBlock ?? 0) - Number(a.createdAtBlock ?? 0);
    });

    return { success: true, data: sorted[0] ?? null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getDecisionsByEvent(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  decision?: TicketDecision,
): Promise<ArkivResult<Entity[]>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.TICKET_DECISION),
        eq("eventKey", eventKey),
        ...(decision ? [eq("decision", decision)] : []),
      ])
      .withAttributes()
      .orderBy("decidedAt", "number", "asc")
      .fetch();

    return { success: true, data: result.entities };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getDecisionForTicket(
  publicClient: PublicArkivClient,
  ticketKey: Hex,
  decision?: TicketDecision,
): Promise<ArkivResult<Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.TICKET_DECISION),
        eq("ticketKey", ticketKey),
        ...(decision ? [eq("decision", decision)] : []),
      ])
      .withAttributes()
      .orderBy("decidedAt", "number", "desc")
      .fetch();

    return { success: true, data: result.entities[0] ?? null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getApprovalForTicket(
  publicClient: PublicArkivClient,
  ticketKey: Hex,
): Promise<ArkivResult<Entity | null>> {
  return getDecisionForTicket(publicClient, ticketKey, "approved");
}

export async function getRejectionForTicket(
  publicClient: PublicArkivClient,
  ticketKey: Hex,
): Promise<ArkivResult<Entity | null>> {
  return getDecisionForTicket(publicClient, ticketKey, "rejected");
}
