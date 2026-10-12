import { createHash, randomBytes } from 'node:crypto';

import type { IssuedToken, TokenGenerator } from '../../domain/ports/token-generator.port';

const TOKEN_BYTES = 32;

/**
 * 256 random bits as base64url, hashed with SHA-256 for storage. The token is
 * high-entropy, so a fast hash is enough: there is nothing to brute-force,
 * and the hash can be looked up by equality.
 */
export class Sha256TokenGenerator implements TokenGenerator {
  issue(): IssuedToken {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
