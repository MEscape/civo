import type { TenantId } from '@modules/auth';

import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import { MAX_NAMED_WEBSITES } from '../list-limits';

import type { WebsiteId } from '../../domain/models/ids';
import type { PublicWebsiteDependencies } from '../website-dependencies';

/**
 * The names of websites, to let someone who belongs to several choose one.
 * A website's name is public (its published pages carry it), so naming it
 * needs no permission; what someone may DO in it is decided by their role in
 * that tenant, as everywhere. The ids come from the caller's own memberships
 * on the server, never from the request.
 *
 * @authorization public A website's name is public information; nothing but the name leaves.
 */
export class ListWebsiteNames {
  constructor(private readonly deps: PublicWebsiteDependencies) {}

  execute(
    tenantIds: readonly TenantId[],
  ): AppResultAsync<
    ReadonlyArray<{ readonly id: WebsiteId; readonly name: string }>,
    InfrastructureAppError
  > {
    return this.deps.websites.findNames(tenantIds, MAX_NAMED_WEBSITES);
  }
}
