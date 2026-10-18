import { toTenantId } from '@modules/auth';
import { websiteQueries } from '@modules/website';

import { orNull } from './or-fail';

/**
 * The name of the website an invitation is for, for the page that opens it
 * (the person has no account yet, so no actor reads it: a website's name is
 * public). `null` when there is none, as for the platform's own invitations.
 */
export async function loadInvitedOrganisation(tenantId: string): Promise<string | null> {
  const names = await orNull(websiteQueries.listWebsiteNames.execute([toTenantId(tenantId)]));
  return names?.[0]?.name ?? null;
}
