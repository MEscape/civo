#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6a9a1f911c9c01f3df36547e3980af0bfc65fd760be7ee85b45581880a51e744/contract';
import endContract from '../../snapshots/6a9a1f911c9c01f3df36547e3980af0bfc65fd760be7ee85b45581880a51e744/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e864e7176ac498f5e5140d09507b1a1a130f54b9a7ee0d1103b38d8748a919a3/contract';
import startContract from '../../snapshots/e864e7176ac498f5e5140d09507b1a1a130f54b9a7ee0d1103b38d8748a919a3/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'AuditEntry',
        columns: [
          col('actorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('actorKind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('details', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occurredAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('severity', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('source', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'AuditEntry_actorKind_check_eb9fa190',
            "\"actorKind\" IN ('MEMBER', 'VISITOR', 'SYSTEM')",
          ),
          checkExpression(
            'AuditEntry_member_actor_check_98aa2b3c',
            '("actorKind" = \'MEMBER\') = ("actorId" IS NOT NULL)',
          ),
          checkExpression('AuditEntry_severity_check_f199a339', "\"severity\" IN ('INFO', 'WARN')"),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_websiteId_actorId_occurredAt_idx_05ff4b64',
        columns: ['websiteId', 'actorId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_websiteId_idx_aa7167ce',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_websiteId_occurredAt_idx_0705c2f4',
        columns: ['websiteId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_websiteId_source_occurredAt_idx_6b615d77',
        columns: ['websiteId', 'source', 'occurredAt'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'AuditEntry',
        foreignKey: {
          name: 'AuditEntry_websiteId_fkey',
          columns: ['websiteId'],
          references: { schema: 'public', table: 'Website', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
