import type { Brand } from '@lib/utils';

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
