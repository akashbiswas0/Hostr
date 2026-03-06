import { jsonToPayload } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import { ExpirationTime } from "@arkiv-network/sdk/utils";
import type { Account, Chain, Hex, Transport } from "viem";
import type { PublicArkivClient, WalletArkivClient } from "@arkiv-network/sdk";
import { ENTITY_TYPES } from "../constants";
import type { ArkivResult, UserProfile } from "../types";
import {
  mediaHost,
  normalizeMediaUrl,
  normalizeText,
  schemaAttributes,
  unixNow,
} from "../v2";

const CONTENT_TYPE = "application/json" as const;

function profileAttributes(
  wallet: Hex,
  data: UserProfile,
  createdAt: number,
): Array<{ key: string; value: string | number }> {
  const avatarImageUrl = normalizeMediaUrl(data.avatarImageUrl);
  const bannerImageUrl = normalizeMediaUrl(data.bannerImageUrl);

  return [
    { key: "type", value: ENTITY_TYPES.USER_PROFILE },
    ...schemaAttributes(),
    { key: "wallet", value: wallet },
    { key: "displayName", value: data.displayName.trim() },
    { key: "displayNameNorm", value: normalizeText(data.displayName) },
    { key: "countryCode", value: (data.countryCode ?? "").toUpperCase() },
    { key: "cityNorm", value: normalizeText(data.city) },
    { key: "language", value: normalizeText(data.language) },
    { key: "createdAt", value: createdAt },
    { key: "updatedAt", value: unixNow() },
    { key: "avatarImageUrl", value: avatarImageUrl },
    { key: "bannerImageUrl", value: bannerImageUrl },
    { key: "avatarHost", value: mediaHost(avatarImageUrl) },
    { key: "hasAvatar", value: avatarImageUrl ? 1 : 0 },
  ];
}

export async function createUserProfileEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  data: UserProfile,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const createdAt = unixNow();
    const result = await walletClient.createEntity({
      payload: jsonToPayload(data),
      contentType: CONTENT_TYPE,
      attributes: profileAttributes(walletClient.account.address, data, createdAt),
      expiresIn: Math.floor(ExpirationTime.fromDays(730)),
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function upsertUserProfileEntity(
  walletClient: WalletArkivClient<Transport, Chain, Account>,
  publicClient: PublicArkivClient,
  data: UserProfile,
): Promise<ArkivResult<{ entityKey: Hex; txHash: Hex }>> {
  try {
    const existing = await publicClient
      .buildQuery()
      .where([eq("type", ENTITY_TYPES.USER_PROFILE)])
      .ownedBy(walletClient.account.address)
      .withAttributes()
      .fetch();

    if (existing.entities.length === 0) {
      return createUserProfileEntity(walletClient, data);
    }

    const current = existing.entities[0];
    const createdAt = Number(
      current.attributes.find((a) => a.key === "createdAt")?.value ?? unixNow(),
    );

    const result = await walletClient.updateEntity({
      entityKey: current.key as Hex,
      payload: jsonToPayload(data),
      contentType: CONTENT_TYPE,
      attributes: profileAttributes(walletClient.account.address, data, createdAt),
      expiresIn: Math.floor(ExpirationTime.fromDays(730)),
    });

    return { success: true, data: result as { entityKey: Hex; txHash: Hex } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
