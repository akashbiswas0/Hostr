"use client";

import { useQuery } from "@tanstack/react-query";
import { publicClient } from "@/lib/arkiv/client";
import { getOrganizerByWallet } from "@/lib/arkiv/queries/profiles";
import type { OrganizerProfile } from "@/lib/arkiv/types";
import type { Entity } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { useWallet } from "./useWallet";

export interface UseOrganizerReturn {
  
  organizer: OrganizerProfile | null;
  
  entity: Entity | null;
  
  entityKey: Hex | null;
  
  isOrganizer: boolean;
  
  isLoading: boolean;
  
  refetch: () => void;
}

export function useOrganizer(): UseOrganizerReturn {
  const { address, isConnected } = useWallet();

  const query = useQuery({
    queryKey: ["organizer", address],
    queryFn: async () => {
      if (!address) return null;

      const result = await getOrganizerByWallet(publicClient, address);

      if (!result.success) {
        throw new Error(result.error);
      }

      
      return result.data ?? null;
    },
    enabled: isConnected && !!address,
    staleTime: 60_000,
  });

  const entity = query.data ?? null;
  const organizer = entity ? (entity.toJson() as OrganizerProfile) : null;

  return {
    organizer,
    entity,
    entityKey: entity ? (entity.key as Hex) : null,
    isOrganizer: entity !== null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
