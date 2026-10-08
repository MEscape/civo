import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';

import { toTenantId } from '@modules/auth';

import { dataSourceCacheTag } from '../../application/contracts/cache-tags';
import { toDataSourceId } from '../../domain/models/ids';
import { restJsonConnector } from '../connector/rest-json-connector';

import type { ConnectorError } from '../../domain/ports/data-source-connector.port';

/**
 * Carries a typed failure through the cache boundary. A function marked
 * `'use cache'` does not cache a thrown error, which is exactly right: a
 * transient failure must never be served from the cache for minutes.
 */
export class SourceReadFailure extends Error {
  constructor(readonly error: ConnectorError) {
    super(error.code);
  }
}

/**
 * CACHE: the raw external response of ONE source.
 *
 *  Owner         this module (infrastructure).
 *  Key           the ids and the stored config blob, so a changed URL,
 *                path or auth mode is a different entry. Volatile fields
 *                of the source (status, last check) are deliberately not
 *                arguments: a connection test must not evict the entry.
 *                Not in the key: the credential. It is a secret and must
 *                never be written into a key; the hard expiry below bounds
 *                how long a rotated credential can keep serving old data.
 *  Audience      identical for every visitor: this path only serves data the
 *                public site displays. Never route per-user data through it.
 *  Tag           `data-source:<id>`; invalidated when the source is removed.
 *  Not cached    anything mapped (a mapping change applies immediately),
 *                test, discovery and preview (they must show live state),
 *                and failures.
 *
 * Lifetime (seconds): clients may reuse an entry for 60; after 120 the next
 * read refreshes it in the background; after 900 it is dropped. Municipal
 * open data tolerates a few minutes of staleness, and anything tighter
 * costs one outbound request per render.
 */
const FRESHNESS = { stale: 60, revalidate: 120, expire: 900 } as const;

/** Arguments are plain JSON, as `'use cache'` requires: ids are branded inside. */
export async function readCachedRestBody(
  tenantId: string,
  dataSourceId: string,
  rawConfig: unknown,
): Promise<unknown> {
  'use cache';
  cacheTag(dataSourceCacheTag(dataSourceId));
  cacheLife(FRESHNESS);

  const result = await restJsonConnector.fetchRestBody({
    tenantId: toTenantId(tenantId),
    dataSourceId: toDataSourceId(dataSourceId),
    rawConfig,
  });
  if (result.isErr()) {
    throw new SourceReadFailure(result.error);
  }
  return result.value;
}
