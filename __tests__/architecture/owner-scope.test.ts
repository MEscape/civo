import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import contract from '@lib/db/contract.json';

import { loadOwnership } from '../../eslint/policy/ownership.mjs';
import { OWNER_SCOPE_KINDS, OWNERSHIP } from '../../eslint/policy/policy.mjs';

/**
 * Tenant isolation at the data layer (`architecture/owner-scope`). A tenant is its website, so what
 * ties a row to its tenant is a column of the table. The rule derives the owned tables from the Prisma
 * contract and the owner columns named in the policy; this test checks that those columns really are
 * the contract's, so the rule cannot go dormant by naming a column no table has.
 */

interface TableFacts {
  readonly columns: Record<string, unknown>;
  readonly checks?: ReadonlyArray<{ readonly expression: string }>;
}

const tables = contract.storage.namespaces.public.entries.table as Record<string, TableFacts>;
const owned = loadOwnership().tables as Record<string, { pins: string[]; via?: string }>;

describe('the tables a tenant owns', () => {
  it('are found by owner columns that exist in the Prisma contract', () => {
    for (const column of OWNERSHIP.columns) {
      expect(
        Object.values(tables).some((table) => column in table.columns),
        `no table has the owner column "${column}": the rule would be dormant`,
      ).toBe(true);
    }
    expect(Object.keys(owned).length).toBeGreaterThan(0);
  });

  it('include every table that has a tenant or website column', () => {
    const withColumn = Object.entries(tables)
      .filter(([, table]) => OWNERSHIP.columns.some((column: string) => column in table.columns))
      .map(([name]) => name);

    expect(Object.keys(owned)).toEqual(expect.arrayContaining(withColumn));
  });

  it('name an owned parent for every table that has no owner column of its own', () => {
    for (const [name, facts] of Object.entries(owned)) {
      if (facts.pins.length === 0) {
        expect(facts.via && facts.via in owned, `${name} needs an owned parent`).toBe(true);
      }
    }
  });

  it('let Website pin by its id because the table itself refuses any other tenant', () => {
    const checks = (tables['Website']?.checks ?? []).map(({ expression }) => expression);

    expect(checks).toContain('"id" = "tenantId"');
    expect(owned['Website']?.pins).toContain('id');
  });
});

/** Every `@owner-scope <kind> <reason>` in a repository: each is a way data is reached without a pinned tenant. */
function ownerScopeTags(): string[] {
  const modules = join(process.cwd(), 'src/modules');
  const found: string[] = [];
  for (const entry of readdirSync(modules, { recursive: true }) as string[]) {
    const path = entry.split(String.fromCharCode(92)).join('/');
    // Every file of an infrastructure layer: a write kept beside the locks it needs is no less a way into the data.
    if (!/\/infrastructure\/.+\.ts$/.test(path)) {
      continue;
    }
    for (const line of readFileSync(join(modules, path), 'utf8').split('\n')) {
      const tag = /@owner-scope\s+([\w-]+)\s*(.*?)\s*(?:\*\/)?$/.exec(line);
      if (tag) {
        found.push(
          `${path.replace('/infrastructure/prisma', '').replace('/infrastructure', '')} :: ${tag[1]}`,
        );
      }
    }
  }
  return found.sort();
}

describe('the ways data is reached without a pinned tenant', () => {
  it('only use kinds the policy knows', () => {
    const kinds = Object.keys(OWNER_SCOPE_KINDS);

    for (const tag of ownerScopeTags()) {
      expect(kinds, tag).toContain(tag.split(' :: ')[1]);
    }
  });

  // Every entry is a reviewed decision, and the rule insists on a reason next to each. Adding a
  // query that is not bound to its tenant changes this list, so it shows in review; a query that
  // CAN be pinned is pinned instead.
  it('are exactly these', () => {
    const expected = [
      // Across tenants on purpose, for the platform administrator or the retention job.
      'audit/prisma-audit-trail.repository.ts :: platform',
      'audit/prisma-audit-trail.repository.ts :: platform',
      'audit/prisma-audit-trail.repository.ts :: platform',
      'auth/prisma-membership.repository.ts :: platform',
      'auth/prisma-invitation.repository.ts :: platform',
      'auth/prisma-tenant.repository.ts :: platform',
      'auth/prisma-membership.repository.ts :: platform',
      // Retention removes what is past its time in every website.
      'booking/prisma-booking-retention.repository.ts :: platform',
      // Bound to the signed-in person, not to a tenant.
      'auth/prisma-membership.repository.ts :: actor',
      'auth/prisma-membership.repository.ts :: actor',
      // The revisions of a page that was just written (or pruned) under its pinned tenant.
      'builder/transactions/page-writes.ts :: child',
      'builder/transactions/page-writes.ts :: child',
      'builder/transactions/page-writes.ts :: child',
      // A booking's placement rows and session counters, written in the transaction of a booking that is already pinned to its tenant and website.
      'booking/transactions/booking-change-write.ts :: child',
      // Authenticated routing metadata only; contents are loaded only after target authorization.
      'data-sources/prisma-data-source.repository.ts :: derived',
      'data-sources/prisma-dataset.repository.ts :: derived',
      // Dataset insertion follows its parent ownership check in the same transaction.
      'data-sources/prisma-dataset.repository.ts :: child',
      // Reached by a secret or a public address: an invitation's token hash, a published site's slug.
      'auth/prisma-invitation.repository.ts :: capability',
      'website/prisma-website.repository.ts :: capability',
      // Auth's explicit readable allowlist, or null only for platform authority.
      'website/prisma-website.repository.ts :: capability',
      // Starting points whose every caller pins (the rule checks each call).
      'auth/prisma-invitation.repository.ts :: builder',
      'builder/prisma-page.repository.ts :: builder',
      'media/prisma-media-asset.repository.ts :: builder',
      'website/prisma-website.repository.ts :: builder',
    ];

    expect(ownerScopeTags()).toEqual(expected.sort());
  });
});
