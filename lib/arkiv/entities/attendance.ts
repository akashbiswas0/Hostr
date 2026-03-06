import { jsonToPayload } from "@arkiv-network/sdk";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import type { Account, Chain, Hex, Transport } from "viem";
import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import { ENTITY_TYPES } from "../constants";
import type { ArkivResult } from "../types";
import {
  mediaHost,
  normalizeMediaUrl,
  schemaAttributes,
  unixNow,
} from "../v2";

const CONTENT_TYPE = "application/json" as const;

export interface ProofOfAttendance {
  eventKey: string;
  attendeeWallet: string;
  eventTitle: string;
  checkedInAt: number;
  issuedAt: number;
  poapImageUrl?: string;
  poapAnimationUrl?: string;
  poapTemplateId?: string;
}

async function assertRefs(
  publicClient: PublicArkivClient,
  eventKey: Hex,
  rsvpKey: Hex,
  checkinKey: Hex,
): Promise<void> {
  const [event, rsvp, checkin] = await Promise.all([
    publicClient.getEntity(eventKey),
    publicClient.getEntity(rsvpKey),
    publicClient.getEntity(checkinKey),
  ]);

  const eventType = event.attributes.find((a) => a.key === "type")?.value;
  const rsvpType = rsvp.attributes.find((a) => a.key === "type")?.value;
  const checkinType = checkin.attributes.find((a) => a.key === "type")?.value;

  if (eventType !== ENTITY_TYPES.EVENT) throw new Error("Invalid event reference for PoAP.");
  if (rsvpType !== ENTITY_TYPES.RSVP) throw new Error("Invalid RSVP reference for PoAP.");
  if (checkinType !== ENTITY_TYPES.CHECKIN) throw new Error("Invalid checkin reference for PoAP.");
}

export async function createPoAEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  eventKey: Hex,
  rsvpKey: Hex,
  attendeeWallet: Hex,
  checkinKey: Hex,
  eventTitle: string,
  media?: {
    poapImageUrl?: string;
    poapAnimationUrl?: string;
    poapTemplateId?: string;
  },
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    await assertRefs(publicClient, eventKey, rsvpKey, checkinKey);

    const issuedAt = unixNow();
    const checkedInAt = issuedAt;
    const poapImageUrl = normalizeMediaUrl(media?.poapImageUrl);
    const poapAnimationUrl = normalizeMediaUrl(media?.poapAnimationUrl);

    const poaData: ProofOfAttendance = {
      eventKey,
      attendeeWallet,
      eventTitle,
      checkedInAt,
      issuedAt,
      poapImageUrl,
      poapAnimationUrl,
      poapTemplateId: media?.poapTemplateId,
    };

    const result = await walletClient.createEntity({
      payload: jsonToPayload(poaData),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.PROOF_OF_ATTENDANCE },
        ...schemaAttributes(),
        { key: "eventKey", value: eventKey },
        { key: "rsvpKey", value: rsvpKey },
        { key: "attendeeWallet", value: attendeeWallet },
        { key: "checkinKey", value: checkinKey },
        { key: "eventTitle", value: eventTitle },
        { key: "issuedAt", value: issuedAt },
        { key: "checkedInAt", value: checkedInAt },
        { key: "proofVersion", value: "v2" },
        { key: "eventCategory", value: "" },
        { key: "poapImageUrl", value: poapImageUrl },
        { key: "poapAnimationUrl", value: poapAnimationUrl },
        { key: "poapTemplateId", value: media?.poapTemplateId ?? "" },
        { key: "poapMediaHost", value: mediaHost(poapImageUrl || poapAnimationUrl) },
        { key: "hasPoapImage", value: poapImageUrl ? 1 : 0 },
      ],
      expiresIn: Math.floor(ExpirationTime.fromDays(730)),
    });

    await walletClient.changeOwnership({
      entityKey: result.entityKey as Hex,
      newOwner: attendeeWallet,
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
