import 'server-only';

import { systemClock } from '@lib/clock';
import { serverEnv } from '@lib/config/server';
import { once } from '@lib/utils';

import { createObjectStore } from './create-object-store';

import type { ObjectStore } from './object-store';

/**
 * The one store of this process. Built on first use, so importing this reads no storage
 * configuration at build time. Only `composition.ts` files call it and hand the result to use
 * cases as an `ObjectStore`.
 */
export const getObjectStore = once<ObjectStore>(() =>
  createObjectStore(serverEnv, { clock: systemClock }),
);
