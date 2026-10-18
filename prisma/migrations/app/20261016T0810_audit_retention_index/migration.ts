#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4a9e0b19c375ac44aa27a65b2da7e733b8638bbfce76777a43cdc0ea5e840621/contract';
import endContract from '../../snapshots/4a9e0b19c375ac44aa27a65b2da7e733b8638bbfce76777a43cdc0ea5e840621/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6a9a1f911c9c01f3df36547e3980af0bfc65fd760be7ee85b45581880a51e744/contract';
import startContract from '../../snapshots/6a9a1f911c9c01f3df36547e3980af0bfc65fd760be7ee85b45581880a51e744/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_occurredAt_idx_c6b89167',
        columns: ['occurredAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
