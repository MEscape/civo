#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6037668cd4fbd2645e705f9f46739302e98d06cdbdcae21ba9cbcb7b90bea7e2/contract';
import startContract from '../../snapshots/6037668cd4fbd2645e705f9f46739302e98d06cdbdcae21ba9cbcb7b90bea7e2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/830c90c47d93cd23f53ed015783c3c087958cc8f355aeff63dc20c0570f73d19/contract';
import endContract from '../../snapshots/830c90c47d93cd23f53ed015783c3c087958cc8f355aeff63dc20c0570f73d19/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'Dataset',
        column: col('path', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
