import { createIdParser } from '@lib/result';
import type { Brand } from '@lib/utils';

import { userNotFound } from '../errors/auth-errors';

/** Opaque identity of an authenticated user. Never a Better Auth type. */
export type ActorId = Brand<string, 'ActorId'>;
export type TenantId = Brand<string, 'TenantId'>;

/**
 * Brands an id the authentication provider has already verified. Only
 * infrastructure adapters call this.
 */
export function toActorId(raw: string): ActorId {
  return raw as ActorId; // Brand constructor: the cast is only permitted here.
}

/**
 * Brands a tenant id that comes from configuration or stored data. Only
 * infrastructure adapters and the composition root call this; never pass a
 * request value. Which tenant an actor belongs to is deployment
 * configuration, so no default lives in the domain.
 */
export function toTenantId(raw: string): TenantId {
  return raw as TenantId; // Brand constructor: the cast is only permitted here.
}

const ACTOR_ID_MAX_LENGTH = 128;

/** Brands an actor id that arrived from a request, after checking its shape. */
export const parseActorId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= ACTOR_ID_MAX_LENGTH,
  brand: toActorId,
  mapError: () => userNotFound(),
});

/** Opaque identity of an invitation. */
export type InvitationId = Brand<string, 'InvitationId'>;

export function toInvitationId(raw: string): InvitationId {
  return raw as InvitationId; // Brand constructor: the cast is only permitted here.
}

/** Brands an invitation id that arrived from a request. Unknown shapes simply match nothing. */
export const parseInvitationId = createIdParser({
  isValid: (raw: string) => raw.length > 0 && raw.length <= ACTOR_ID_MAX_LENGTH,
  brand: toInvitationId,
  mapError: () => userNotFound(),
});
