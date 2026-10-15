#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/bf9734fc22758f0fe299e99bc5cb673987c32098fd49476ccb37117961a85517/contract';
import startContract from '../../snapshots/bf9734fc22758f0fe299e99bc5cb673987c32098fd49476ccb37117961a85517/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/f145cbaf68b4d5edf359e361be8923b690d68d59dea60851009be4187998077e/contract';
import endContract from '../../snapshots/f145cbaf68b4d5edf359e361be8923b690d68d59dea60851009be4187998077e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropColumn({
        schema: 'public',
        table: 'BookableResource',
        column: 'employeeMayEditHours',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
