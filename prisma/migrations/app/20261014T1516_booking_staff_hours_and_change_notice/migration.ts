#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/1e876b8f97eb65aeb6303327d066385ada450ca62a22d0ffed2eb6d2aa8b524a/contract';
import endContract from '../../snapshots/1e876b8f97eb65aeb6303327d066385ada450ca62a22d0ffed2eb6d2aa8b524a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f145cbaf68b4d5edf359e361be8923b690d68d59dea60851009be4187998077e/contract';
import startContract from '../../snapshots/f145cbaf68b4d5edf359e361be8923b690d68d59dea60851009be4187998077e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'BookableResource',
        column: col('managerChange', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'BookingLocation',
        column: col('staffHours', 'json', { codecRef: { codecId: 'pg/json@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
