import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import contract from '@lib/db/contract.json';

import { TENANT_SCOPE_KINDS, TENANT_TABLES } from '../../eslint/policy/policy.mjs';

/**
 * Tenant isolation at the data layer (`architecture/tenant-scope`). A tenant is its website, so
 * what ties a row to its tenant is a column of the table. The policy lists those columns; this
 * test derives the same facts from the Prisma contract, so the list cannot drift from the schema,
 * and a table added without a place in it fails here before any query on it can go unchecked.
 */

interface TableFacts {
  readonly columns: Record<string, unknown>;
  readonly checks?: ReadonlyArray<{ readonly expression: string }>;
  readonly foreignKeys?: ReadonlyArray<{ readonly target: { readonly tableName: string } }>;
}

const tables = contract.storage.namespaces.public.entries.table as Record<string, TableFacts>;

function derive(table: TableFacts) {
  const own = ['tenantId', 'websiteId'].filter((column) => column in table.columns);
  // `Website` is its own tenant: the table refuses any row whose tenantId differs from its id.
  const isItsOwnTenant = (table.checks ?? []).some(({ expression }) =>
    /^"id" = "tenantId"$/.test(expression),
  );
  const pins = isItsOwnTenant ? [...own, 'id'] : own;
  if (pins.length > 0) {
    return { pins };
  }
  const parent = (table.foreignKeys ?? []).map(({ target }) => target.tableName)[0];
  return { pins: [], via: parent };
}

describe('the tables a tenant owns', () => {
  it('are exactly the tables of the Prisma contract, with the columns that tie a row to its owner', () => {
    const derived = Object.fromEntries(
      Object.entries(tables).map(([name, table]) => [name, derive(table)]),
    );

    expect(TENANT_TABLES).toEqual(derived);
  });

  it('name an owned parent for every table that has no owner column of its own', () => {
    for (const [name, facts] of Object.entries<{ pins: string[]; via?: string }>(TENANT_TABLES)) {
      if (facts.pins.length === 0) {
        expect(facts.via && facts.via in TENANT_TABLES, `${name} needs an owned parent`).toBe(true);
      }
    }
  });

  it('let Website pin by its id because the table itself refuses any other tenant', () => {
    const checks = (tables['Website']?.checks ?? []).map(({ expression }) => expression);

    expect(checks).toContain('"id" = "tenantId"');
  });
});

/** Every `@tenant-scope <kind> <reason>` in a repository: each is a way data is reached without a pinned tenant. */
function tenantScopeTags(): string[] {
  const modules = join(process.cwd(), 'src/modules');
  const found: string[] = [];
  for (const entry of readdirSync(modules, { recursive: true }) as string[]) {
    const path = entry.split(String.fromCharCode(92)).join('/');
    if (!/\/infrastructure\/prisma\/[^/]+\.ts$/.test(path)) {
      continue;
    }
    for (const line of readFileSync(join(modules, path), 'utf8').split('\n')) {
      const tag = /@tenant-scope\s+([\w-]+)\s*(.*?)\s*(?:\*\/)?$/.exec(line);
      if (tag) {
        found.push(`${path.replace('/infrastructure/prisma', '')} :: ${tag[1]}`);
      }
    }
  }
  return found.sort();
}

describe('the ways data is reached without a pinned tenant', () => {
  it('only use kinds the policy knows', () => {
    const kinds = Object.keys(TENANT_SCOPE_KINDS);

    for (const tag of tenantScopeTags()) {
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
      'auth/prisma-membership.repository.ts :: platform',
      'website/prisma-website.repository.ts :: platform',
      'website/prisma-website.repository.ts :: platform',
      // Bound to the signed-in person, not to a tenant.
      'auth/prisma-membership.repository.ts :: actor',
      // Reached by a secret or a public address: an invitation's token hash, a published site's slug.
      'auth/prisma-invitation.repository.ts :: capability',
      'auth/prisma-invitation.repository.ts :: capability',
      'auth/prisma-invitation.repository.ts :: capability',
      'website/prisma-website.repository.ts :: capability',
      // Rows of a parent that was pinned in the same transaction.
      'booking/prisma-booking.repository.ts :: child',
      'booking/prisma-booking.repository.ts :: child',
      'builder/prisma-page.repository.ts :: child',
      'builder/prisma-page.repository.ts :: child',
      'builder/prisma-page.repository.ts :: child',
      'data-sources/prisma-dataset.repository.ts :: child',
      // Starting points whose every caller pins (the rule checks each call).
      'auth/prisma-invitation.repository.ts :: builder',
      'builder/prisma-page.repository.ts :: builder',
      'website/prisma-website.repository.ts :: builder',
    ];

    expect(tenantScopeTags()).toEqual(expected.sort());
  });
});
