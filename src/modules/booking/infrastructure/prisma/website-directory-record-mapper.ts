import { toTenantId } from '@modules/auth';
import type { TenantId } from '@modules/auth';

/** Field list for `.select(...)`: the only column the directory reads. */
export const WEBSITE_OWNER_SELECT = ['tenantId'] as const satisfies readonly ['tenantId'];

export interface WebsiteOwnerRecord {
  readonly tenantId: string;
}

/** The owning tenant of a website record, or `null` when there was no such website. */
export function toWebsiteOwner(record: WebsiteOwnerRecord | null): TenantId | null {
  return record === null ? null : toTenantId(record.tenantId);
}
