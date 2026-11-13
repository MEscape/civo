#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/61f6f09684065b48eafc535ebb1d1e5a18b98226e4697ccafce90dd882dbbc16/contract';
import startContract from '../../snapshots/61f6f09684065b48eafc535ebb1d1e5a18b98226e4697ccafce90dd882dbbc16/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9d92cde95e0b535ac9943c3c0bbd4b7985c07e5d7b49eefaa229ea866f16a21d/contract';
import endContract from '../../snapshots/9d92cde95e0b535ac9943c3c0bbd4b7985c07e5d7b49eefaa229ea866f16a21d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'ActorMessage',
        constraint: 'ActorMessage_type_check_c5ee5c65',
      }),
      this.dropColumn({ schema: 'public', table: 'BookableResource', column: 'managerChange' }),
      this.dropNotNull({ schema: 'public', table: 'ActorMessage', column: 'bookingId' }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ActorMessage',
        constraint: 'ActorMessage_booking_rule_f40704c8',
        expression: sql`("type" = 'calendar_changed') = ("bookingId" IS NULL)`,
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'ActorMessage',
        constraint: 'ActorMessage_type_check_63fc7e5f',
        expression: sql`"type" IN ('assigned', 'unassigned', 'cancelled', 'rescheduled', 'calendar_changed')`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
