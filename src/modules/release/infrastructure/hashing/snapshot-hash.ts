import { createHash } from 'node:crypto';

import { stableStringify } from '@lib/utils';

import type { StoredReleaseSnapshot } from '../prisma/release-record-mapper';

export function hashStoredSnapshot(snapshot: StoredReleaseSnapshot): string {
  return createHash('sha256').update(stableStringify(snapshot)).digest('hex');
}
