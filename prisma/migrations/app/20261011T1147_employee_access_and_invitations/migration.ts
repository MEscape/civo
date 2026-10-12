#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6037668cd4fbd2645e705f9f46739302e98d06cdbdcae21ba9cbcb7b90bea7e2/contract';
import endContract from '../../snapshots/6037668cd4fbd2645e705f9f46739302e98d06cdbdcae21ba9cbcb7b90bea7e2/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9aa95be9a3b60ed66458173adfabf2f76ec03f6c46efdb41bdd4cf845baaf85a/contract';
import startContract from '../../snapshots/9aa95be9a3b60ed66458173adfabf2f76ec03f6c46efdb41bdd4cf845baaf85a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Invitation',
        columns: [
          col('acceptedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('invitedBy', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'BookableResource',
        column: col('assignedActorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'BookableResource',
        column: col('employeeMayEditHours', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'Invitation',
        constraint: 'Invitation_tokenHash_key',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookableResource',
        index: 'BookableResource_tenantId_assignedActorId_idx_3b737228',
        columns: ['tenantId', 'assignedActorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invitation',
        index: 'Invitation_tenantId_email_idx_88e149c0',
        columns: ['tenantId', 'email'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
