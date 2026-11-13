import 'dotenv/config';
import '../lib/server-runtime';

import { Client } from 'pg';

import { WUERZBURG_WEBSITE_ID } from '../../prisma/seed/wuerzburg-manifest';
import { serverEnv } from '../../src/lib/config/server';
import { advisoryLock, db, disconnectDb } from '../../src/lib/db';

const ACCOUNTS = ['platform_admin', 'admin', 'editor', 'contributor', 'viewer', 'employee'].map(
  (role) => `wuerzburg-demo-${role}`,
);

if (serverEnv.NODE_ENV === 'production') {
  throw new Error('Reference-city reset is forbidden in production');
}
if (!process.argv.includes('--confirm-wuerzburg')) {
  throw new Error('Reset removes only the reference tenant. Pass --confirm-wuerzburg to execute.');
}

try {
  await db.transaction(async (tx) => {
    await advisoryLock(tx, 'seed:wuerzburg');
    // Bookings must release their assignment and service references before the tenant cascades.
    await tx.orm.public.Booking.where({ websiteId: WUERZBURG_WEBSITE_ID }).deleteAndCount();
    await tx.orm.public.Website.where({
      id: WUERZBURG_WEBSITE_ID,
      tenantId: WUERZBURG_WEBSITE_ID,
    }).updateAndCount({ publishedReleaseId: null });
    await tx.orm.public.Website.where({
      id: WUERZBURG_WEBSITE_ID,
      tenantId: WUERZBURG_WEBSITE_ID,
    }).deleteAndCount();
    await tx.orm.public.Membership.where({ tenantId: WUERZBURG_WEBSITE_ID }).deleteAndCount();
    await tx.orm.public.Invitation.where({ tenantId: WUERZBURG_WEBSITE_ID }).deleteAndCount();
    for (const actorId of ACCOUNTS) {
      await tx.orm.public.Membership.where({ actorId, tenantId: 'platform' }).deleteAndCount();
    }
  });
  if (serverEnv.AUTH_DATABASE_URL !== undefined) {
    const client = new Client({ connectionString: serverEnv.AUTH_DATABASE_URL });
    await client.connect();
    try {
      await client.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [ACCOUNTS]);
    } finally {
      await client.end();
    }
  }
  process.stdout.write(
    'Removed only the Würzburg reference tenant and its exact fictional identity IDs.\n',
  );
} finally {
  await disconnectDb();
}
