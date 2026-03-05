"use client";

import { useQuery } from "@tanstack/react-query";
import { publicClient } from "@/lib/arkiv/client";
import { getRsvpByAttendee } from "@/lib/arkiv/entities/rsvp";
import { eq } from "@arkiv-network/sdk/query";
import { ENTITY_TYPES } from "@/lib/arkiv/constants";
import type { RSVP } from "@/lib/arkiv/types";
import type { Entity } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { useWallet } from "./useWallet";

export interface UseRsvpReturn {
  
  hasRsvp: boolean;
  
  rsvp: RSVP | null;
  
  entity: Entity | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRsvp(eventKey: Hex | undefined): UseRsvpReturn {
  const { address, isConnected } = useWallet();

  const query = useQuery({
    queryKey: ["rsvp", eventKey, address],
    queryFn: async () => {
      
      if (!eventKey || !address) return null;

      const result = await getRsvpByAttendee(publicClient, eventKey, address);

      if (!result.success) {
        throw new Error(result.error);
      }

      
      return result.data;
    },
    enabled: isConnected && !!address && !!eventKey,
    staleTime: 30_000,
  });

  const entity = query.data ?? null;
  const rsvp = entity ? (entity.toJson() as RSVP) : null;

  return {
    hasRsvp: entity !== null,
    rsvp,
    entity,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export interface UseMyRsvpsReturn {
  
  rsvpEntities: Entity[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMyRsvps(): UseMyRsvpsReturn {
  const { address, isConnected } = useWallet();

  const query = useQuery({
    queryKey: ["my-rsvps", address],
    queryFn: async () => {
      if (!address) return [];
      const result = await publicClient
        .buildQuery()
        .where([eq("type", ENTITY_TYPES.RSVP)])
        .ownedBy(address as Hex)
        .withPayload()
        .withAttributes()
        .fetch();
      return result.entities;
    },
    enabled: isConnected && !!address,
    staleTime: 30_000,
  });

  return {
    rsvpEntities: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
