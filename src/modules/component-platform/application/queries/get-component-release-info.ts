import type { NotFoundAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { componentNotRegistered } from '../../domain/errors/component-platform-errors';
import { toReleaseInfo } from '../component-platform-view-mappers';

import type { PublicComponentPlatformDependencies } from '../component-platform-dependencies';
import type { ComponentReleaseInfo } from '../contracts/catalog-views';

/**
 * What a release needs to pin and check for a component: its implementation
 * version and, for every contract it relies on, the minimum it needs and the
 * version in force. A type that is not registered is an error the caller
 * decides how to treat.
 *
 * @authorization public Reads the component catalog, which is code and contains nothing per tenant.
 */
export class GetComponentReleaseInfo {
  constructor(private readonly deps: PublicComponentPlatformDependencies) {}

  execute(type: string): AppResult<ComponentReleaseInfo, NotFoundAppError> {
    const definition = this.deps.registry.find(type);
    return definition === undefined ? err(componentNotRegistered()) : ok(toReleaseInfo(definition));
  }
}
