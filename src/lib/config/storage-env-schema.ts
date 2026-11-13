import { z } from 'zod';

import { httpUrl } from './env-primitives';
import { refineEnv } from './env-rules';

import type { EnvRule } from './env-rules';

/** The naming rules shared by S3, R2, B2 and RustFS buckets. */
const bucketName = z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, {
  error: 'Must be a 3-63 character bucket name of lower-case letters, digits, "." and "-".',
});

const storageEnvObjectSchema = z.object({
  /**
   * The S3 API of the service: Neon Object Storage (`AWS_ENDPOINT_URL_S3`) in production, the
   * SeaweedFS container locally. Buckets are always addressed as `endpoint/bucket/key`.
   */
  STORAGE_S3_ENDPOINT: httpUrl,
  /** The region the service signs for (Neon: its `AWS_REGION`). Unset: `auto`, which most services accept. */
  STORAGE_S3_REGION: z.string().min(1).optional(),
  STORAGE_S3_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_S3_SECRET_ACCESS_KEY: z.string().min(1),
  /** Holds public objects; its whole content is readable through `STORAGE_PUBLIC_BASE_URL`. */
  STORAGE_S3_PUBLIC_BUCKET: bucketName.optional(),
  /** Holds private objects, readable only through short-lived signed URLs. Never exposed publicly. */
  STORAGE_S3_PRIVATE_BUCKET: bucketName.optional(),
  /**
   * Where the public bucket is served from, up to and including the bucket where the service puts
   * it in the path (Neon: `https://<branch>.storage.<…>.neon.tech/<public-bucket>`). An object's
   * public URL is this, `/`, and its key.
   */
  STORAGE_PUBLIC_BASE_URL: httpUrl.optional(),
});

/** The storage variables, validated and typed. */
export type StorageEnv = z.infer<typeof storageEnvObjectSchema>;

/** A public origin is a place, not a request: credentials, a query or a fragment do not belong in it. */
const carriesMoreThanAPlace = (url: string) => {
  const { username, password, search, hash } = new URL(url);
  return Boolean(username || password || search || hash);
};

/**
 * Object storage, shared by every module that stores files, and always configured like the
 * database: there is no way to switch it off, so a deployment cannot look healthy while storing
 * nothing. What may differ is which buckets exist (public, private or both) and, for a public
 * bucket, where it is served from.
 */
export const storageEnvRules: ReadonlyArray<EnvRule<StorageEnv>> = [
  {
    path: 'STORAGE_S3_PUBLIC_BUCKET',
    violated: (env) => !env.STORAGE_S3_PUBLIC_BUCKET && !env.STORAGE_S3_PRIVATE_BUCKET,
    message: 'Set STORAGE_S3_PUBLIC_BUCKET, STORAGE_S3_PRIVATE_BUCKET or both.',
  },
  {
    path: 'STORAGE_S3_PRIVATE_BUCKET',
    violated: (env) =>
      Boolean(env.STORAGE_S3_PUBLIC_BUCKET) &&
      env.STORAGE_S3_PUBLIC_BUCKET === env.STORAGE_S3_PRIVATE_BUCKET,
    message:
      'The private bucket must differ from the public one, or private objects would be served publicly.',
  },
  {
    path: 'STORAGE_PUBLIC_BASE_URL',
    violated: (env) => Boolean(env.STORAGE_S3_PUBLIC_BUCKET) && !env.STORAGE_PUBLIC_BASE_URL,
    message: 'STORAGE_PUBLIC_BASE_URL is required when STORAGE_S3_PUBLIC_BUCKET is set.',
  },
  {
    path: 'STORAGE_PUBLIC_BASE_URL',
    violated: (env) => Boolean(env.STORAGE_PUBLIC_BASE_URL) && !env.STORAGE_S3_PUBLIC_BUCKET,
    message: 'STORAGE_PUBLIC_BASE_URL is set but there is no STORAGE_S3_PUBLIC_BUCKET to serve.',
  },
  {
    path: 'STORAGE_PUBLIC_BASE_URL',
    violated: (env) =>
      env.STORAGE_PUBLIC_BASE_URL !== undefined &&
      carriesMoreThanAPlace(env.STORAGE_PUBLIC_BASE_URL),
    message: 'STORAGE_PUBLIC_BASE_URL must not contain credentials, a query or a fragment.',
  },
];

/** The storage variables with their cross-variable rules; composed into the server schema. */
export const storageEnvSchema = storageEnvObjectSchema.superRefine(refineEnv(storageEnvRules));
