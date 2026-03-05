import { jsonToPayload } from "@arkiv-network/sdk"
import { eq } from "@arkiv-network/sdk/query"
import { ExpirationTime } from "@arkiv-network/sdk/utils"
import type { Account, Chain, Hex, Transport } from "viem"
import type {
  PublicArkivClient,
  WalletArkivClient,
} from "@arkiv-network/sdk"
import { ENTITY_TYPES } from "../constants"
import type { ArkivResult, OrganizerProfile } from "../types"

const CONTENT_TYPE = "application/json" as const

export async function createOrganizerEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  data: OrganizerProfile,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const result = await walletClient.createEntity({
      payload: jsonToPayload(data),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.ORGANIZER_PROFILE },
        { key: "wallet", value: walletClient.account.address },
        { key: "name", value: data.name },
      ],
      // Organizer profiles are long-lived identity entities (2 years, renewed on edit)
      expiresIn: Math.floor(ExpirationTime.fromDays(730)),
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateOrganizerEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  entityKey: Hex,
  data: OrganizerProfile,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const result = await walletClient.updateEntity({
      entityKey,
      payload: jsonToPayload(data),
      contentType: CONTENT_TYPE,
      attributes: [
        { key: "type", value: ENTITY_TYPES.ORGANIZER_PROFILE },
        { key: "wallet", value: walletClient.account.address },
        { key: "name", value: data.name },
      ],
      // Renew 2-year lifespan on each edit
      expiresIn: Math.floor(ExpirationTime.fromDays(730)),
    })

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function getOrganizerByWallet(
  publicClient: PublicArkivClient,
  walletAddress: Hex,
): Promise<ArkivResult<import("@arkiv-network/sdk").Entity | null>> {
  try {
    const result = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.ORGANIZER_PROFILE)])
      .ownedBy(walletAddress)
      .withPayload()
      .withAttributes()
      .fetch()

    const entity = result.entities[0] ?? null
    return { success: true, data: entity }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
