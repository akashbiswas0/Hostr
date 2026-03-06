export const SCHEMA_VERSION = 2 as const;

export const ENTITY_TYPES = {
  ORGANIZER_PROFILE: "organizer_profile_v2",
  USER_PROFILE: "user_profile_v2",
  EVENT: "event_v2",
  RSVP: "rsvp_v2",
  RSVP_DECISION: "rsvp_decision_v2",
  CHECKIN: "checkin_v2",
  PROOF_OF_ATTENDANCE: "poa_v2",
  EVENT_SEARCH_TOKEN: "event_search_token_v2",
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
