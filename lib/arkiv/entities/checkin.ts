import { jsonToPayload } from "@arkiv-network/sdk";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import type { Account, Chain, Hex, Transport } from "viem";
import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import { ENTITY_TYPES } from "../constants";
import type { ArkivResult } from "../types";
import { ensureEvenSeconds, schemaAttributes, unixNow } from "../v2";

const CONTENT_TYPE = "application/json" as const;

function expiresInFromEventEnd(eventEndDate: number): number {
  const secondsFromNow = eventEndDate - unixNow();
  const gracePeriod = ExpirationTime.fromDays(2);
  const seconds = Math.floor(
    Math.max(secondsFromNow + gracePeriod, ExpirationTime.fromHours(1)),
  );
  return ensureEvenSeconds(seconds);
}

async function assertRefs(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  rsvpKey?: Hex,
): Promise<void> {
  const event = await publicClient.getEntity(eventKey);
  const eventType = event.attributes.find((a) => a.key === "type")?.value;
  if (eventType !== ENTITY_TYPES.EVENT) {
    throw new Error("Invalid event reference for check-in.");
  }

  if (!rsvpKey) return;
  const rsvp = await publicClient.getEntity(rsvpKey);
  const rsvpType = rsvp.attributes.find((a) => a.key === "type")?.value;
  if (rsvpType !== ENTITY_TYPES.RSVP) {
    throw new Error("Invalid RSVP reference for check-in.");
  }
}

export async function createCheckinEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  attendeeWallet: Hex,
  eventEndDate: number,
  rsvpKey?: Hex,
  method: "qr" | "manual" = "manual",
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertRefs(publicClient, eventKey, rsvpKey);

    const checkedInAt = unixNow();

    const checkinData = {
      eventKey,
      attendeeWallet,
      rsvpKey: rsvpKey ?? "",
      checkedInAt,
      checkinMethod: method,
      checkinGate: "default",
    };

    const result = await walletClient.createEntity({
      payload: jsonToPayload(checkinData),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.CHECKIN },
        ...schemaAttributes(),
        { key: "eventKey", value: eventKey },
        { key: "attendeeWallet", value: attendeeWallet },
        { key: "rsvpKey", value: rsvpKey ?? "" },
        { key: "checkedInAt", value: checkedInAt },
        { key: "checkinMethod", value: method },
        { key: "checkinGate", value: "default" },
      ],
      expiresIn: expiresInFromEventEnd(eventEndDate),
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
