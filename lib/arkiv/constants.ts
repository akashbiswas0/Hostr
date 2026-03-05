export const ENTITY_TYPES = {
  ORGANIZER_PROFILE: "organizer_profile",
  EVENT: "event",
  RSVP: "rsvp",
  CHECKIN: "checkin",
  RSVP_APPROVAL: "rsvp_approval",
  RSVP_REJECTION: "rsvp_rejection",
  PROOF_OF_ATTENDANCE: "proof_of_attendance",
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
