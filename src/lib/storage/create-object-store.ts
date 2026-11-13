import type { Clock } from '@lib/clock';
import type { StorageEnv } from '@lib/config/server';

import { S3ObjectStore } from './s3-object-store';

import type { ObjectStore } from './object-store';

/**
 * Builds the store the storage settings describe. The schema already guarantees what it needs, and
 * storage cannot be switched off: a store that fails reports the failure, it is never replaced by
 * another provider or by memory.
 */
export function createObjectStore(env: StorageEnv, deps: { clock: Clock }): ObjectStore {
  return new S3ObjectStore({
    clock: deps.clock,
    region: env.STORAGE_S3_REGION ?? 'auto',
    endpoint: env.STORAGE_S3_ENDPOINT,
    accessKeyId: env.STORAGE_S3_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_S3_SECRET_ACCESS_KEY,
    ...(env.STORAGE_S3_PUBLIC_BUCKET ? { publicBucket: env.STORAGE_S3_PUBLIC_BUCKET } : {}),
    ...(env.STORAGE_S3_PRIVATE_BUCKET ? { privateBucket: env.STORAGE_S3_PRIVATE_BUCKET } : {}),
    ...(env.STORAGE_PUBLIC_BASE_URL ? { publicBaseUrl: env.STORAGE_PUBLIC_BASE_URL } : {}),
  });
}
