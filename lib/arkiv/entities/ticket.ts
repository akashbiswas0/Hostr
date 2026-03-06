import { jsonToPayload } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import type { Entity, PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import type { Account, Chain, Hex, Transport } from "viem";
import { ENTITY_TYPES } from "../constants";
import { assertCallerOwnsEntity, assertCallerOwnsHostEvent } from "../ownership";
import type { ArkivResult, Ticket, TicketDecision, TicketStatus } from "../types";
import { ensureEvenSeconds, schemaAttributes, unixNow } from "../v2";

const CONTENT_TYPE = "application/json" as const;

function expiresInFromEventEnd(eventEndDate: number, status?: TicketStatus): number {
  if (status === "pending") {
    return ensureEvenSeconds(Math.floor(ExpirationTime.fromDays(7)));
  }
  const secondsFromNow = eventEndDate - unixNow();
  const gracePeriod = ExpirationTime.fromDays(7);
  const seconds = Math.floor(
    Math.max(secondsFromNow + gracePeriod, ExpirationTime.fromHours(1)),
  );
  return ensureEvenSeconds(seconds);
}

function toUnix(value: string | undefined): number {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / 1_000);
}

async function ensureHostEventExists(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<Entity> {
  const event = await publicClient.getEntity(eventKey);
  const type = event.attributes.find((a) => a.key === "type")?.value;
  if (type !== ENTITY_TYPES.HOSTEVENT) {
    throw new Error("Invalid hostevent reference for ticket.");
  }
  return event;
}

async function ensureSingleActiveTicket(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  attendeeWallet: Hex,
): Promise<void> {
  const existing = await publicClient
    .buildQuery()
    .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey)])
    .ownedBy(attendeeWallet)
    .withAttributes()
    .fetch();

  const hasActive = existing.entities.some((entity) => {
    const status = String(entity.attributes.find((a) => a.key === "status")?.value ?? "pending");
    return status !== "not-going";
  });

  if (hasActive) {
    throw new Error("Active ticket already exists for this attendee and hostevent.");
  }
}

async function upsertDecisionEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  params: {
    eventKey: Hex;
    ticketKey: Hex;
    attendeeWallet: Hex;
    decision: TicketDecision;
    eventEndDate: number;
  },
): Promise<{ entityKey: Hex; txHash: Hex }> {
  const existing = await publicClient
    .buildQuery()
    .where([
      eq("type", ENTITY_TYPES.TICKET_DECISION),
      eq("eventKey", params.eventKey),
      eq("ticketKey", params.ticketKey),
    ])
    .withAttributes()
    .fetch();

  if (existing.entities.length > 0) {
    await walletClient.mutateEntities({
      deletes: existing.entities.map((entity) => ({ entityKey: entity.key as Hex })),
    });
  }

  const decidedAt = unixNow();
  const result = await walletClient.createEntity({
    payload: jsonToPayload({
      eventKey: params.eventKey,
      ticketKey: params.ticketKey,
      attendeeWallet: params.attendeeWallet,
      decision: params.decision,
      decidedAt,
    }),
    contentType: CONTENT_TYPE,
    attributes: [
      { key: "type", value: ENTITY_TYPES.TICKET_DECISION },
      ...schemaAttributes(),
      { key: "eventKey", value: params.eventKey },
      { key: "ticketKey", value: params.ticketKey },
      { key: "attendeeWallet", value: params.attendeeWallet },
      { key: "decision", value: params.decision },
      { key: "decisionReasonCode", value: "" },
      { key: "decidedAt", value: decidedAt },
      { key: "deciderWallet", value: walletClient.account.address },
    ],
    expiresIn: ensureEvenSeconds(
      Math.floor(
        Math.max(
          params.eventEndDate - unixNow() + ExpirationTime.fromDays(14),
          ExpirationTime.fromHours(1),
        ),
      ),
    ),
  });

  return result as { entityKey: Hex; txHash: Hex };
}

async function applyDecisionStatusToTicket(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  ticket: Entity,
  nextStatus: TicketStatus,
  eventEndDate: number,
): Promise<void> {
  const currentStatus = String(
    ticket.attributes.find((a) => a.key === "status")?.value ?? "pending",
  ) as TicketStatus;
  if (currentStatus !== nextStatus) {
    assertTicketTransition(currentStatus, nextStatus);
  }

  const attrs = ticket.attributes.map((attr) => {
    if (attr.key === "status") return { key: "status", value: nextStatus };
    if (attr.key === "lastActionAt") return { key: "lastActionAt", value: unixNow() };
    return attr;
  });
  if (!attrs.some((attr) => attr.key === "status")) {
    attrs.push({ key: "status", value: nextStatus });
  }
  if (!attrs.some((attr) => attr.key === "lastActionAt")) {
    attrs.push({ key: "lastActionAt", value: unixNow() });
  }

  await walletClient.updateEntity({
    entityKey: ticket.key as Hex,
    payload: ticket.payload ?? jsonToPayload(ticket.toJson()),
    contentType: CONTENT_TYPE,
    attributes: attrs,
    expiresIn: expiresInFromEventEnd(eventEndDate, nextStatus),
  });
}

function assertTicketTransition(current: TicketStatus, next: TicketStatus): void {
  const transitions: Record<TicketStatus, TicketStatus[]> = {
    pending: ["confirmed", "waitlisted", "not-going"],
    waitlisted: ["confirmed", "not-going"],
    confirmed: ["checked-in", "not-going"],
    "checked-in": [],
    "not-going": [],
  };
  const allowed = transitions[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid ticket status transition: ${current} -> ${next}`);
  }
}

async function reconcileEvent(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<void> {
  const { reconcileHostEventIntegrity } = await import("./event");
  await reconcileHostEventIntegrity(walletClient, publicClient, eventKey);
}

export async function createTicketEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  data: Ticket,
  eventEndDate: number,
  initialStatus: TicketStatus = "pending",
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const eventKey = data.eventKey as Hex;
    const attendeeWallet = walletClient.account.address;
    const event = await ensureHostEventExists(publicClient, eventKey);
    await ensureSingleActiveTicket(publicClient, eventKey, attendeeWallet);

    const result = await walletClient.createEntity({
      payload: jsonToPayload({ ...data }),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.TICKET },
        ...schemaAttributes(),
        { key: "eventKey", value: data.eventKey },
        {
          key: "organizerWallet",
          value: String(event.attributes.find((a) => a.key === "organizerWallet")?.value ?? event.owner ?? ""),
        },
        { key: "attendeeWallet", value: attendeeWallet },
        { key: "status", value: initialStatus },
        { key: "requestedAt", value: unixNow() },
        { key: "lastActionAt", value: unixNow() },
        { key: "attendanceMode", value: data.attendanceMode ?? "in_person" },
        { key: "ticketType", value: data.ticketType ?? "standard" },
        { key: "source", value: "web" },
        { key: "cancelReasonCode", value: "" },
        { key: "attendeeAvatarUrlSnapshot", value: data.attendeeAvatarUrlSnapshot ?? "" },
        {
          key: "attendeeDisplayNameSnapshot",
          value: data.attendeeDisplayNameSnapshot ?? data.attendeeName,
        },
      ],
      expiresIn: expiresInFromEventEnd(eventEndDate, initialStatus),
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updateTicketStatus(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  status: TicketStatus,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertCallerOwnsEntity(publicClient, entityKey, walletClient.account.address, "ticket");

    const entity = await publicClient.getEntity(entityKey);
    const currentStatus = String(
      entity.attributes.find((a) => a.key === "status")?.value ?? "pending",
    ) as TicketStatus;
    assertTicketTransition(currentStatus, status);

    const eventKey = entity.attributes.find((a) => a.key === "eventKey")?.value as Hex;
    const event = await ensureHostEventExists(publicClient, eventKey);
    const eventPayload = event.toJson() as { endDate?: string };
    const endDate = Math.max(toUnix(eventPayload.endDate), unixNow() + 3_600);

    const attrs = entity.attributes.map((attr) => {
      if (attr.key === "status") return { key: "status", value: status };
      if (attr.key === "lastActionAt") return { key: "lastActionAt", value: unixNow() };
      return attr;
    });
    if (!attrs.some((attr) => attr.key === "status")) {
      attrs.push({ key: "status", value: status });
    }
    if (!attrs.some((attr) => attr.key === "lastActionAt")) {
      attrs.push({ key: "lastActionAt", value: unixNow() });
    }

    const result = await walletClient.updateEntity({
      entityKey,
      payload: entity.payload ?? jsonToPayload(entity.toJson()),
      contentType: CONTENT_TYPE,
      attributes: attrs,
      expiresIn: expiresInFromEventEnd(endDate, status),
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function deleteTicket(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertCallerOwnsEntity(publicClient, entityKey, walletClient.account.address, "ticket");
    const result = await walletClient.deleteEntity({ entityKey });
    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function approveTicket(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  ticketEntityKey: Hex,
  eventEntityKey: Hex,
  attendeeWallet: Hex,
  eventEndDate: number,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertCallerOwnsHostEvent(publicClient, eventEntityKey, walletClient.account.address);
    const ticket = await publicClient.getEntity(ticketEntityKey);
    const ticketType = ticket.attributes.find((a) => a.key === "type")?.value;
    if (ticketType !== ENTITY_TYPES.TICKET) {
      throw new Error("Invalid ticket reference for decision.");
    }
    const ticketEventKey = ticket.attributes.find((a) => a.key === "eventKey")?.value as Hex;
    if (String(ticketEventKey).toLowerCase() !== String(eventEntityKey).toLowerCase()) {
      throw new Error("Ticket does not belong to this hostevent.");
    }

    const ticketAttendee = String(
      ticket.attributes.find((a) => a.key === "attendeeWallet")?.value ?? ticket.owner ?? "",
    ).toLowerCase();
    if (ticketAttendee !== String(attendeeWallet).toLowerCase()) {
      throw new Error("Decision attendeeWallet does not match ticket attendee.");
    }

    const result = await upsertDecisionEntity(walletClient, publicClient, {
      eventKey: eventEntityKey,
      ticketKey: ticketEntityKey,
      attendeeWallet,
      decision: "approved",
      eventEndDate,
    });

    await applyDecisionStatusToTicket(
      walletClient,
      ticket,
      "confirmed",
      eventEndDate,
    );

    await reconcileEvent(walletClient, publicClient, eventEntityKey);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function rejectTicket(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  ticketEntityKey: Hex,
  eventEntityKey: Hex,
  attendeeWallet: Hex,
  eventEndDate: number,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertCallerOwnsHostEvent(publicClient, eventEntityKey, walletClient.account.address);
    const ticket = await publicClient.getEntity(ticketEntityKey);
    const ticketType = ticket.attributes.find((a) => a.key === "type")?.value;
    if (ticketType !== ENTITY_TYPES.TICKET) {
      throw new Error("Invalid ticket reference for decision.");
    }

    const ticketEventKey = ticket.attributes.find((a) => a.key === "eventKey")?.value as Hex;
    if (String(ticketEventKey).toLowerCase() !== String(eventEntityKey).toLowerCase()) {
      throw new Error("Ticket does not belong to this hostevent.");
    }

    const ticketAttendee = String(
      ticket.attributes.find((a) => a.key === "attendeeWallet")?.value ?? ticket.owner ?? "",
    ).toLowerCase();
    if (ticketAttendee !== String(attendeeWallet).toLowerCase()) {
      throw new Error("Decision attendeeWallet does not match ticket attendee.");
    }

    const result = await upsertDecisionEntity(walletClient, publicClient, {
      eventKey: eventEntityKey,
      ticketKey: ticketEntityKey,
      attendeeWallet,
      decision: "rejected",
      eventEndDate,
    });

    await applyDecisionStatusToTicket(
      walletClient,
      ticket,
      "not-going",
      eventEndDate,
    );

    await reconcileEvent(walletClient, publicClient, eventEntityKey);
    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function promoteFirstWaitlistedTicket(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  eventEndDate?: number,
): Promise<ArkivResult<{ promoted: boolean; entityKey?: Hex }>> {
  try {
    await assertCallerOwnsHostEvent(publicClient, eventKey, walletClient.account.address);
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.TICKET), eq("eventKey", eventKey), eq("status", "waitlisted")])
      .withAttributes()
      .orderBy("requestedAt", "number", "asc")
      .fetch();

    const first = result.entities[0];
    if (!first) return { success: true, data: { promoted: false } };

    const attendeeWallet = (
      first.attributes.find((a) => a.key === "attendeeWallet")?.value ?? first.owner
    ) as Hex;

    const decisionRes = await approveTicket(
      walletClient,
      publicClient,
      first.key as Hex,
      eventKey,
      attendeeWallet,
      eventEndDate ?? unixNow() + 86_400,
    );
    if (!decisionRes.success) throw new Error(decisionRes.error);

    return { success: true, data: { promoted: true, entityKey: first.key as Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
