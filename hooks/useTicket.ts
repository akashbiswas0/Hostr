"use client";

import { useQuery } from "@tanstack/react-query";
import type { Entity } from "@arkiv-network/sdk";
import { eq } from "@arkiv-network/sdk/query";
import type { Hex } from "viem";
import { publicClient } from "@/lib/arkiv/client";
import { ENTITY_TYPES } from "@/lib/arkiv/constants";
import { getTicketByAttendee } from "@/lib/arkiv/queries/tickets";
import type { Ticket } from "@/lib/arkiv/types";
import { useWallet } from "./useWallet";

export interface UseTicketReturn {
  hasTicket: boolean;
  ticket: Ticket | null;
  entity: Entity | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTicket(eventKey: Hex | undefined): UseTicketReturn {
  const { address, isConnected } = useWallet();

  const query = useQuery({
    queryKey: ["ticket", eventKey, address],
    queryFn: async () => {
      if (!eventKey || !address) return null;

      const result = await getTicketByAttendee(publicClient, eventKey, address);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: isConnected && !!address && !!eventKey,
    staleTime: 30_000,
  });

  const entity = query.data ?? null;
  const ticket = entity ? (entity.toJson() as Ticket) : null;

  return {
    hasTicket: entity !== null,
    ticket,
    entity,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export interface UseMyTicketsReturn {
  ticketEntities: Entity[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMyTickets(): UseMyTicketsReturn {
  const { address, isConnected } = useWallet();

  const query = useQuery({
    queryKey: ["my-tickets", address],
    queryFn: async () => {
      if (!address) return [];
      const result = await publicClient
        .buildQuery()
        .where([eq("type", ENTITY_TYPES.TICKET)])
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
    ticketEntities: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
