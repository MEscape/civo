import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { TenantId } from '../models/ids';

/**
 * Which tenants exist, and their public names. A tenant is a website, which
 * another module owns. Access grants require its existence; a verified
 * invitation may reveal only its name, never its configuration or members.
 */
export interface TenantRepository {
  /** Authorized callers supply an allowlist; null is reserved for platform-wide authority. At most `limit` websites; `isTruncated` says there are more. */
  listNames(
    tenantIds: readonly TenantId[] | null,
    limit: number,
  ): AppResultAsync<
    {
      readonly websites: ReadonlyArray<{ readonly id: TenantId; readonly name: string }>;
      readonly isTruncated: boolean;
    },
    InfrastructureAppError
  >;
  exists(tenantId: TenantId): AppResultAsync<boolean, InfrastructureAppError>;

  /** Only the public website name, for an invitation whose token has already been verified; null when the website is gone. */
  findName(tenantId: TenantId): AppResultAsync<string | null, InfrastructureAppError>;
}
