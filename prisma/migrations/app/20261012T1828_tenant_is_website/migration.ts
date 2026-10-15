#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/830c90c47d93cd23f53ed015783c3c087958cc8f355aeff63dc20c0570f73d19/contract';
import startContract from '../../snapshots/830c90c47d93cd23f53ed015783c3c087958cc8f355aeff63dc20c0570f73d19/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/bf9734fc22758f0fe299e99bc5cb673987c32098fd49476ccb37117961a85517/contract';
import endContract from '../../snapshots/bf9734fc22758f0fe299e99bc5cb673987c32098fd49476ccb37117961a85517/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addCheckConstraint({
        schema: 'public',
        table: 'Website',
        constraint: 'Website_tenant_is_website_check_34a4fea9',
        expression: '"id" = "tenantId"',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
