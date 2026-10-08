import type { NotFoundAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import { componentNotRegistered } from '../../domain/errors/component-platform-errors';

import type { PublicComponentPlatformDependencies } from '../component-platform-dependencies';

export interface GetComponentDefaultPropsInput {
  readonly type: string;
  readonly version: number;
}

/**
 * The props a freshly created node of `type` starts with at exactly
 * `version`: what a release's migration needs as the BASE of its three-way
 * merge. What a "default" is stays defined here, so no consumer reads the
 * definition itself.
 *
 * `null` means the version is known to be gone: only the current version of
 * a component is retained for now, and a consumer must report an older one
 * as unresolvable instead of guessing. An unregistered type is an error the
 * caller decides how to treat.
 *
 * @authorization public Reads the component catalog, which is code and contains nothing per tenant.
 */
export class GetComponentDefaultProps {
  constructor(private readonly deps: PublicComponentPlatformDependencies) {}

  execute(
    input: GetComponentDefaultPropsInput,
  ): AppResult<Readonly<Record<string, unknown>> | null, NotFoundAppError> {
    const definition = this.deps.registry.find(input.type);
    if (definition === undefined) {
      return err(componentNotRegistered());
    }
    return ok(definition.version === input.version ? definition.defaultProps : null);
  }
}
