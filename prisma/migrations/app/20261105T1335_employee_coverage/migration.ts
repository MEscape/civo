#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/61f6f09684065b48eafc535ebb1d1e5a18b98226e4697ccafce90dd882dbbc16/contract';
import endContract from '../../snapshots/61f6f09684065b48eafc535ebb1d1e5a18b98226e4697ccafce90dd882dbbc16/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/841b4c34b80602ee1dd54fbc83be9f5303875454c51dc622943bf9220e66cea9/contract';
import startContract from '../../snapshots/841b4c34b80602ee1dd54fbc83be9f5303875454c51dc622943bf9220e66cea9/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'BookableResource',
        column: col('coverage', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'BookableResource',
        constraint: 'BookableResource_coverage_rule_ebade982',
        expression: sql`"coverage" IS NULL OR jsonb_typeof("coverage") = 'array'`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
