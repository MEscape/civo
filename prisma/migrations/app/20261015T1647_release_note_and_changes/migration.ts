#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/09bee852dc49521cded2094645ef16bd0dd67201686d1525ea0ef18ec4277d88/contract';
import endContract from '../../snapshots/09bee852dc49521cded2094645ef16bd0dd67201686d1525ea0ef18ec4277d88/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/1e876b8f97eb65aeb6303327d066385ada450ca62a22d0ffed2eb6d2aa8b524a/contract';
import startContract from '../../snapshots/1e876b8f97eb65aeb6303327d066385ada450ca62a22d0ffed2eb6d2aa8b524a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'WebsiteRelease',
        column: col('changes', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'WebsiteRelease',
        column: col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
