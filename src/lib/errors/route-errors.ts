import { logger } from '@lib/logger';

import type { AppError } from './app-error';

/** Logged once, here, then handed to the nearest `error.tsx` boundary. */
export function escalate(error: AppError): never {
  logger.error('route.failed', error, { code: error.code });
  throw new Error(error.code, { cause: error });
}
