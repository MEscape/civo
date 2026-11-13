import { serverEnv } from '../../src/lib/config/server';
import { db } from '../../src/lib/db';

import { seedWuerzburgAccounts } from './wuerzburg-accounts';
import { readWuerzburgManifest } from './wuerzburg-manifest';
import { seedWuerzburgInTransaction } from './wuerzburg-persistence';

import type { SeedModule } from './helper/seed-types';

const seed: SeedModule = {
  name: 'Würzburg reference city',
  order: 10,
  async run(context) {
    if (serverEnv.NODE_ENV === 'production') {
      throw new Error('Reference city seeding is disabled in production');
    }
    const manifest = await readWuerzburgManifest();
    const hasAuthAccounts = await seedWuerzburgAccounts(manifest);
    await db.transaction((tx) => seedWuerzburgInTransaction(tx, manifest, { hasAuthAccounts }));
    context.say(
      `Würzburg reference ready: ${manifest.pages.length} draft pages; Component Lab excluded from publication.`,
    );
  },
};

// eslint-disable-next-line import/no-default-export -- The existing seed discovery contract requires a default SeedModule export.
export default seed;
