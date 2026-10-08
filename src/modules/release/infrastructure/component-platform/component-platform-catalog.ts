import type { ComponentReleaseInfo } from '@modules/component-platform';

import type { NotFoundAppError } from '@lib/errors';
import type { AppResult } from '@lib/result';
import { isJsonRecord } from '@lib/utils';

import type { NodeProps } from '../../domain/models/page-tree';
import type { ResolvedComponent } from '../../domain/models/publishable';
import type { ComponentCatalog } from '../../domain/ports/component-catalog.port';

/** The platform's `getComponentReleaseInfo`, as `composition.ts` hands it in. */
export type GetComponentReleaseInfoFn = (
  type: string,
) => AppResult<ComponentReleaseInfo, NotFoundAppError>;

/** The platform's `getComponentDefaultProps`, as `composition.ts` hands it in. */
export type GetComponentDefaultPropsFn = (
  type: string,
  version: number,
) => AppResult<Readonly<Record<string, unknown>> | null, NotFoundAppError>;

/**
 * The release module's ONLY dependency on the component platform, through
 * two of its published capabilities.
 *
 * "Current" means as registered right now: `resolve` is called at publish
 * time, when "now" is the version a release should pin, and at migration
 * time, when "now" is the version to upgrade to. The platform reports the
 * contract versions in force together with the component, so there is no
 * second lookup to keep in step. Already published releases keep their own
 * recorded dependencies and never ask again.
 */
export class ComponentPlatformCatalog implements ComponentCatalog {
  constructor(
    private readonly getReleaseInfo: GetComponentReleaseInfoFn,
    private readonly getDefaultProps: GetComponentDefaultPropsFn,
  ) {}

  resolve(type: string): ResolvedComponent | null {
    return this.getReleaseInfo(type).match(
      (info) => ({
        type,
        version: info.version,
        contracts: info.dependsOnContracts.map((dependency) => ({
          contract: dependency.contract,
          minVersion: dependency.minVersion,
          currentVersion: dependency.currentVersion,
        })),
      }),
      // The only failure is "not registered", which this port reports as null.
      () => null,
    );
  }

  defaultProps(type: string, version: number): NodeProps | null {
    return this.getDefaultProps(type, version).match(
      // Defaults that are not plain JSON cannot be a merge BASE.
      (props) => (isJsonRecord(props) ? props : null),
      () => null,
    );
  }
}
