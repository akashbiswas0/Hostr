"use client";

import { useQuery } from "@tanstack/react-query";
import { publicClient } from "@/lib/arkiv/client";
import {
  getEventByKey,
  getAllUpcomingEvents,
  getEventsByOrganizer,
  type EventFilters,
} from "@/lib/arkiv/queries/events";
import type { Event } from "@/lib/arkiv/types";
import type { Entity } from "@arkiv-network/sdk";
import type { Hex } from "viem";
import { useWallet } from "./useWallet";

export interface UseEventReturn {

  event: Event | null;

  entity: Entity | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseEventsReturn {
  events: Entity[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEvent(entityKey: Hex | undefined): UseEventReturn {
  const query = useQuery({
    queryKey: ["event", entityKey],
    queryFn: async () => {
      if (!entityKey) return null;

      const result = await getEventByKey(publicClient, entityKey);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!entityKey,
    staleTime: 30_000,
  });

  const entity = query.data ?? null;
  const event = entity ? (entity.toJson() as Event) : null;

  return {
    event,
    entity,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export function useEvents(filters?: EventFilters): UseEventsReturn {
  const query = useQuery({
    queryKey: [
      "events",
      filters?.category,
      filters?.location,
      filters?.dateFrom,
      filters?.dateTo,
      filters?.status,
      filters?.isOnline,
      filters?.keyword,
      filters?.approvalMode,
      filters?.hasImage,
      filters?.hasSeatsOnly,
      filters?.format,
    ],
    queryFn: async () => {
      const result = await getAllUpcomingEvents(publicClient, filters);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 30_000,
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}

export function useOrganizerEvents(): UseEventsReturn {
  const { address, isConnected } = useWallet();

  const query = useQuery({
    queryKey: ["organizer-events", address],
    queryFn: async () => {
      if (!address) return [];
      const result = await getEventsByOrganizer(publicClient, address as Hex);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    enabled: isConnected && !!address,
    staleTime: 30_000,
  });

  return {
    events: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  };
}
