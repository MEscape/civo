import { createHash } from 'node:crypto';

import type { ContentHasher } from '../../domain/ports/content-hasher.port';

export class Sha256ContentHasher implements ContentHasher {
  hash(text: string): string {
    return createHash('sha256').update(text).digest('hex');
  }
}
