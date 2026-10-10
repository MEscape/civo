#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/33c6d679b6ee43881825cfa03e7313e5db728b44a1475cf59c72cab7f92f8761/contract';
import startContract from '../../snapshots/33c6d679b6ee43881825cfa03e7313e5db728b44a1475cf59c72cab7f92f8761/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9aa95be9a3b60ed66458173adfabf2f76ec03f6c46efdb41bdd4cf845baaf85a/contract';
import endContract from '../../snapshots/9aa95be9a3b60ed66458173adfabf2f76ec03f6c46efdb41bdd4cf845baaf85a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addCheckConstraint({
        schema: 'public',
        table: 'Booking',
        constraint: 'Booking_group_size_rule_69eea88d',
        expression: '"participants" >= 1 AND "participants" <= "sessionCapacity"',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'Booking',
        constraint: 'Booking_span_check_956c7fbe',
        expression: '"start" < "end" AND "occupiedStart" <= "start" AND "end" <= "occupiedEnd"',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'BookingResource',
        constraint: 'BookingResource_span_check_62352ed1',
        expression: '"occupiedStart" < "occupiedEnd"',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
