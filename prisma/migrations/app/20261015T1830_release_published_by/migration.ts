#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/09bee852dc49521cded2094645ef16bd0dd67201686d1525ea0ef18ec4277d88/contract';
import startContract from '../../snapshots/09bee852dc49521cded2094645ef16bd0dd67201686d1525ea0ef18ec4277d88/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/e864e7176ac498f5e5140d09507b1a1a130f54b9a7ee0d1103b38d8748a919a3/contract';
import endContract from '../../snapshots/e864e7176ac498f5e5140d09507b1a1a130f54b9a7ee0d1103b38d8748a919a3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'WebsiteRelease',
        column: col('publishedBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
