import type { Clock } from '@lib/clock';

import type { ComponentRegistry } from '../domain/components/component-registry';
import type { ContentSource } from '../domain/ports/content-source.port';

/** What the module's queries are built from. */
export interface PublicComponentPlatformDependencies {
  readonly registry: ComponentRegistry;
  readonly live: ContentSource;
  readonly clock: Clock;
}
