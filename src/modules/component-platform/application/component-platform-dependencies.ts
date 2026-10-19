import type { Clock } from '@lib/clock';
import type { ClientAddressProvider, RateLimiter } from '@lib/rate-limit';

import type { ListContent } from './queries/list-content';
import type { ComponentRegistry } from '../domain/components/component-registry';
import type { ContentSource } from '../domain/ports/content-source.port';

/** What the module's queries are built from. */
export interface PublicComponentPlatformDependencies {
  readonly registry: ComponentRegistry;
  readonly live: ContentSource;
  readonly clock: Clock;
}

/**
 * What reading a window of a published chart is built from: the content list it serves from, and a
 * budget per visitor, counted by client address.
 */
export interface TrendWindowDependencies {
  readonly listContent: Pick<ListContent, 'execute'>;
  readonly rateLimiter: RateLimiter;
  readonly clientAddress: ClientAddressProvider;
}
