import type { Actor } from '@modules/auth';

import { toWebsiteId } from '../../domain/models/ids';

import type { BookingScope } from '../../domain/ports/booking.repository';

/**
 * The scope of a signed-in actor's booking queries. The tenant is the actor's, resolved on the
 * server; a tenant IS its website (one id, `Website_tenant_is_website_check`), so the website is
 * the same id. Nothing here comes from the request, which is what makes another website's booking
 * "not found" instead of a trust decision. Every repository statement pins both.
 */
export function scopeOfActor(actor: Actor): BookingScope {
  return { tenantId: actor.tenantId, websiteId: toWebsiteId(actor.tenantId) };
}
