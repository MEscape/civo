/**
 * Bookings with one session key share their resources: a class, a room used by a group. Every
 * other booking is alone in its session. The key of a shared session starts with this prefix, and
 * nothing else does.
 */
export const SHARED_SESSION_PREFIX = 'session:';

export function isSharedSession(sessionKey: string): boolean {
  return sessionKey.startsWith(SHARED_SESSION_PREFIX);
}

/** The session of a booking that shares its resources with nobody: its own id says so. */
export function privateSessionKey(bookingId: string): string {
  return `booking:${bookingId}`;
}
