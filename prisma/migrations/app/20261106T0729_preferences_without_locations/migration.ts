#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/656d8313d617b80ea93a8f4725811e2ccb9a3560895fd76454bab8008e832a81/contract';
import endContract from '../../snapshots/656d8313d617b80ea93a8f4725811e2ccb9a3560895fd76454bab8008e832a81/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9d92cde95e0b535ac9943c3c0bbd4b7985c07e5d7b49eefaa229ea866f16a21d/contract';
import startContract from '../../snapshots/9d92cde95e0b535ac9943c3c0bbd4b7985c07e5d7b49eefaa229ea866f16a21d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'EmployeePreference',
        constraint: 'EmployeePreference_lists_rule_38ca54e6',
      }),
      this.dropColumn({ schema: 'public', table: 'EmployeePreference', column: 'locationIds' }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'EmployeePreference',
        constraint: 'EmployeePreference_lists_rule_d08a4f86',
        expression: sql`jsonb_typeof("serviceIds") = 'array'`,
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
