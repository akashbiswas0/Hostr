import { jsonToPayload } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import type { Account, Chain, Hex, Transport } from "viem";
import type {
  Entity,
  PublicArkivClient,
  WalletArkivClient,
} from "@arkiv-network/sdk";
import { ENTITY_TYPES } from "../constants";
import type {
  ArkivResult,
  RSVP,
  RsvpDecision,
  RSVPStatus,
} from "../types";
import { ensureEvenSeconds, schemaAttributes, unixNow } from "../v2";

const CONTENT_TYPE = "application/json" as const;

function expiresInFromEventEnd(eventEndDate: number, status?: RSVPStatus): number {
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

async function ensureEventExists(
  publicClient: PublicArkivClient,
  eventKey: Hex,
): Promise<Entity> {
  const event = await publicClient.getEntity(eventKey);
  const type = event.attributes.find((a) => a.key === "type")?.value;
  if (type !== ENTITY_TYPES.EVENT) {
    throw new Error("Invalid event reference for RSVP.");
  }
  return event;
}

async function upsertDecisionEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  params: {
    eventKey: Hex;
    rsvpKey: Hex;
    attendeeWallet: Hex;
    decision: RsvpDecision;
    eventEndDate: number;
  },
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const existing = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP_DECISION),
        eq("eventKey", params.eventKey),
        eq("rsvpKey", params.rsvpKey),
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
        rsvpKey: params.rsvpKey,
        attendeeWallet: params.attendeeWallet,
        decision: params.decision,
        decidedAt,
      }),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.RSVP_DECISION },
        ...schemaAttributes(),
        { key: "eventKey", value: params.eventKey },
        { key: "rsvpKey", value: params.rsvpKey },
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

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function createRsvpEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  data: RSVP,
  eventEndDate: number,
  initialStatus: RSVPStatus = "confirmed",
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const event = await ensureEventExists(publicClient, data.eventKey as Hex);

    const rsvpData: RSVP = { ...data };

    const result = await walletClient.createEntity({
      payload: jsonToPayload(rsvpData),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.RSVP },
        ...schemaAttributes(),
        { key: "eventKey", value: data.eventKey },
        {
          key: "organizerWallet",
          value:
            String(
              event.attributes.find((a) => a.key === "organizerWallet")?.value ??
                event.owner ??
                "",
            ) || "",
        },
        { key: "attendeeWallet", value: walletClient.account.address },
        { key: "status", value: initialStatus },
        { key: "requestedAt", value: unixNow() },
        { key: "lastActionAt", value: unixNow() },
        { key: "attendanceMode", value: data.attendanceMode ?? "in_person" },
        { key: "ticketType", value: data.ticketType ?? "standard" },
        { key: "source", value: "web" },
        { key: "cancelReasonCode", value: "" },
        {
          key: "attendeeAvatarUrlSnapshot",
          value: data.attendeeAvatarUrlSnapshot ?? "",
        },
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

export async function updateRsvpStatus(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  entityKey: Hex,
  status: RSVPStatus,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const entity = await publicClient.getEntity(entityKey);
    const currentStatusAttr = entity.attributes.find((a) => a.key === "status");
    const currentStatus = currentStatusAttr?.value as string;

    const VALID_TRANSITIONS: Record<string, RSVPStatus[]> = {
      pending: ["confirmed", "waitlisted", "not-going"],
      waitlisted: ["confirmed", "not-going"],
      confirmed: ["checked-in", "not-going"],
      "checked-in": [],
      "not-going": [],
    };

    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(status)) {
      return {
        success: false,
        error: `Invalid status transition: ${currentStatus} -> ${status}`,
      };
    }

    const eventKey = entity.attributes.find((a) => a.key === "eventKey")?.value as Hex;
    const event = await ensureEventExists(publicClient, eventKey);
    const eventPayload = event.toJson() as { endDate?: string };
    const eventEndDate = Math.max(
      toUnixOrNow(eventPayload.endDate),
      unixNow() + 3_600,
    );

    const updatedAttrs = entity.attributes.map((attr) => {
      if (attr.key === "status") return { key: "status", value: status };
      if (attr.key === "lastActionAt") return { key: "lastActionAt", value: unixNow() };
      return attr;
    });

    const hasLastActionAt = updatedAttrs.some((attr) => attr.key === "lastActionAt");
    if (!hasLastActionAt) {
      updatedAttrs.push({ key: "lastActionAt", value: unixNow() });
    }

    const result = await walletClient.updateEntity({
      entityKey,
      payload: entity.payload ?? jsonToPayload(entity.toJson() as RSVP),
      contentType: CONTENT_TYPE,
      attributes: updatedAttrs,
      expiresIn: expiresInFromEventEnd(eventEndDate, status),
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function toUnixOrNow(value: string | undefined): number {
  if (!value) return unixNow();
  if (/^\d+$/.test(value)) return Number(value);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return unixNow();
  return Math.floor(ms / 1_000);
}

export async function deleteRsvp(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  entityKey: Hex,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const result = await walletClient.deleteEntity({ entityKey });
    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function confirmRsvp(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  rsvpEntityKey: Hex,
  eventEntityKey: Hex,
  attendeeWallet: Hex,
  eventEndDate: number,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  const decision = await upsertDecisionEntity(walletClient, publicClient, {
    eventKey: eventEntityKey,
    rsvpKey: rsvpEntityKey,
    attendeeWallet,
    decision: "approved",
    eventEndDate,
  });

  if (!decision.success) return decision;

  try {
    const { updateRsvpCount } = await import("./event");
    await updateRsvpCount(walletClient, publicClient, eventEntityKey, true);
  } catch {
    // Non-fatal: count can be recomputed later.
  }

  return decision;
}

export async function rejectRsvp(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  rsvpEntityKey: Hex,
  eventEntityKey: Hex,
  attendeeWallet: Hex,
  eventEndDate: number,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  return upsertDecisionEntity(walletClient, publicClient, {
    eventKey: eventEntityKey,
    rsvpKey: rsvpEntityKey,
    attendeeWallet,
    decision: "rejected",
    eventEndDate,
  });
}

export async function promoteFirstWaitlisted(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  eventEndDate?: number,
): Promise<ArkivResult<{ promoted: boolean; entityKey?: Hex }>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([
        eq("type", ENTITY_TYPES.RSVP),
        eq("eventKey", eventKey),
        eq("status", "waitlisted"),
      ])
      .withAttributes()
      .orderBy("requestedAt", "number", "asc")
      .fetch();

    if (result.entities.length === 0) {
      return { success: true, data: { promoted: false } };
    }

    const first = result.entities[0];
    const attendeeWallet =
      (first.attributes.find((a) => a.key === "attendeeWallet")?.value as Hex) ??
      (first.owner as Hex);

    const decisionRes = await confirmRsvp(
      walletClient,
      publicClient,
      first.key as Hex,
      eventKey,
      attendeeWallet,
      eventEndDate ?? unixNow() + 86_400,
    );

    if (!decisionRes.success) {
      throw new Error(decisionRes.error);
    }

    return {
      success: true,
      data: { promoted: true, entityKey: first.key as Hex },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
