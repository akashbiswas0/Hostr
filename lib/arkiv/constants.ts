export const SCHEMA_VERSION = 2 as const;

export const ENTITY_TYPES = {
  ORGANIZER_PROFILE: "organizer_profile",
  USER_PROFILE: "user_profile",
  HOSTEVENT: "hostevent",
  TICKET: "ticket",
  TICKET_DECISION: "ticket_decision",
  CHECKIN: "checkin",
  PROOF_OF_ATTENDANCE: "poa",
  EVENT_SEARCH_TOKEN: "event_search_token",
  EVENT_CAPACITY_FLAG: "event_capacity_flag",
  EVENT_TRENDING_FLAG: "event_trending_flag",
} as const;

export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];

export function expiresInSeconds(seconds: number): number {
  return Math.floor(Date.now() / 1_000) + seconds;
}

export function expiresInMinutes(minutes: number): number {
  return expiresInSeconds(minutes * 60);
}

export function expiresInHours(hours: number): number {
  return expiresInMinutes(hours * 60);
}

export function expiresInDays(days: number): number {
  return expiresInHours(days * 24);
}

export function expiresInYears(years: number): number {
  return expiresInDays(years * 365);
}

export const NEVER_EXPIRES = expiresInYears(100);

export const KAOLIN_CHAIN_ID = 60138453025;
export const KAOLIN_RPC_URL = "https://kaolin.hoodi.arkiv.network/rpc";
