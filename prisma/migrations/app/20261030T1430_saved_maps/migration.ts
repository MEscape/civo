#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/841b4c34b80602ee1dd54fbc83be9f5303875454c51dc622943bf9220e66cea9/contract';
import endContract from '../../snapshots/841b4c34b80602ee1dd54fbc83be9f5303875454c51dc622943bf9220e66cea9/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f8a86643bd8434a41ad316d4846a9e2be8ca65979b3a798ad42890711ad294c4/contract';
import startContract from '../../snapshots/f8a86643bd8434a41ad316d4846a9e2be8ca65979b3a798ad42890711ad294c4/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'SavedMap',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('settings', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'SavedMap_description_rule_e354da0e',
            sql`"description" IS NULL OR char_length("description") <= 500`,
          ),
          checkExpression(
            'SavedMap_name_rule_38e74a36',
            sql`char_length("name") BETWEEN 1 AND 120`,
          ),
          checkExpression('SavedMap_version_rule_efca705d', sql`"version" > 0`),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'SavedMap',
        constraint: 'SavedMap_id_websiteId_key',
        columns: ['id', 'websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SavedMap',
        index: 'SavedMap_websiteId_idx_aa7167ce',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'SavedMap',
        index: 'SavedMap_websiteId_name_id_idx_bfb0270a',
        columns: ['websiteId', 'name', 'id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'SavedMap',
        foreignKey: {
          name: 'SavedMap_websiteId_fkey',
          columns: ['websiteId'],
          references: { schema: 'public', table: 'Website', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
