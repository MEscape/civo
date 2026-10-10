#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c7c52e3229880c553d3655940f128f9ac431dbc469c0a3e8aef493807391b6cc/contract';
import endContract from '../../snapshots/c7c52e3229880c553d3655940f128f9ac431dbc469c0a3e8aef493807391b6cc/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'DataSource',
        columns: [
          col('config', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('kind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastCheckedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('lastError', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('UNKNOWN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('DataSource_kind_check_c3ae767f', "\"kind\" IN ('MOCK', 'REST')"),
          checkExpression(
            'DataSource_status_check_ff3434bd',
            "\"status\" IN ('UNKNOWN', 'OK', 'ERROR')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Dataset',
        columns: [
          col('canonicalKind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('dataSourceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastFetchedAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('mapping', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('UNKNOWN'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Dataset_status_check_ff3434bd',
            "\"status\" IN ('UNKNOWN', 'OK', 'ERROR')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Membership',
        columns: [
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Page',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('path', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'PageConfig',
        columns: [
          col('content', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('pageId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('version', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'PageConfig_status_check_1b4a7b6b',
            "\"status\" IN ('DRAFT', 'PUBLISHED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Website',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('publishedReleaseId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('templateKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'WebsiteMigration',
        columns: [
          col('appliedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('appliedBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('plan', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('proposedBy', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolutions', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('sourceReleaseId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PROPOSED'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'WebsiteMigration_status_check_953d0064',
            "\"status\" IN ('PROPOSED', 'APPLIED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'WebsiteRelease',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('publishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('releaseNumber', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('snapshot', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('snapshotHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'WebsiteRelease_status_check_4475a53d',
            "\"status\" IN ('DRAFT', 'PUBLISHED', 'FAILED', 'ROLLED_BACK')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'WebsiteTheme',
        columns: [
          col('accentColor', 'text', {
            notNull: true,
            default: lit('#C9782F'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('bodyFont', 'text', {
            notNull: true,
            default: lit('Inter'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('headingFont', 'text', {
            notNull: true,
            default: lit('Source Serif 4'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('primaryColor', 'text', {
            notNull: true,
            default: lit('#1F3A34'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('radius', 'text', {
            notNull: true,
            default: lit('md'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('secondaryColor', 'text', {
            notNull: true,
            default: lit('#7A8B85'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('spacingScale', 'text', {
            notNull: true,
            default: lit('comfortable'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Dataset',
        constraint: 'Dataset_dataSourceId_slug_key',
        columns: ['dataSourceId', 'slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Membership',
        constraint: 'Membership_actorId_tenantId_role_key',
        columns: ['actorId', 'tenantId', 'role'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Page',
        constraint: 'Page_websiteId_path_key',
        columns: ['websiteId', 'path'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'PageConfig',
        constraint: 'PageConfig_pageId_version_key',
        columns: ['pageId', 'version'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Website',
        constraint: 'Website_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Website',
        constraint: 'Website_publishedReleaseId_key',
        columns: ['publishedReleaseId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Website',
        constraint: 'Website_id_tenantId_key',
        columns: ['id', 'tenantId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'WebsiteRelease',
        constraint: 'WebsiteRelease_websiteId_releaseNumber_key',
        columns: ['websiteId', 'releaseNumber'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'WebsiteTheme',
        constraint: 'WebsiteTheme_websiteId_key',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DataSource',
        index: 'DataSource_websiteId_idx_aa7167ce',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Dataset',
        index: 'Dataset_dataSourceId_idx_536a4d74',
        columns: ['dataSourceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Page',
        index: 'Page_websiteId_tenantId_idx_ac8953f0',
        columns: ['websiteId', 'tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'PageConfig',
        index: 'PageConfig_pageId_idx_8caaba4f',
        columns: ['pageId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteMigration',
        index: 'WebsiteMigration_sourceReleaseId_idx_7dff7977',
        columns: ['sourceReleaseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteMigration',
        index: 'WebsiteMigration_websiteId_createdAt_idx_5579a8b3',
        columns: ['websiteId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteMigration',
        index: 'WebsiteMigration_websiteId_idx_aa7167ce',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteRelease',
        index: 'WebsiteRelease_websiteId_idx_aa7167ce',
        columns: ['websiteId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'DataSource',
        foreignKey: {
          name: 'DataSource_websiteId_fkey',
          columns: ['websiteId'],
          references: { schema: 'public', table: 'Website', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Dataset',
        foreignKey: {
          name: 'Dataset_dataSourceId_fkey',
          columns: ['dataSourceId'],
          references: { schema: 'public', table: 'DataSource', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Page',
        foreignKey: {
          name: 'Page_websiteId_tenantId_fkey',
          columns: ['websiteId', 'tenantId'],
          references: { schema: 'public', table: 'Website', columns: ['id', 'tenantId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'PageConfig',
        foreignKey: {
          name: 'PageConfig_pageId_fkey',
          columns: ['pageId'],
          references: { schema: 'public', table: 'Page', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Website',
        foreignKey: {
          name: 'Website_publishedReleaseId_fkey',
          columns: ['publishedReleaseId'],
          references: { schema: 'public', table: 'WebsiteRelease', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WebsiteMigration',
        foreignKey: {
          name: 'WebsiteMigration_websiteId_fkey',
          columns: ['websiteId'],
          references: { schema: 'public', table: 'Website', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WebsiteMigration',
        foreignKey: {
          name: 'WebsiteMigration_sourceReleaseId_fkey',
          columns: ['sourceReleaseId'],
          references: { schema: 'public', table: 'WebsiteRelease', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WebsiteRelease',
        foreignKey: {
          name: 'WebsiteRelease_websiteId_fkey',
          columns: ['websiteId'],
          references: { schema: 'public', table: 'Website', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'WebsiteTheme',
        foreignKey: {
          name: 'WebsiteTheme_websiteId_fkey',
          columns: ['websiteId'],
          references: { schema: 'public', table: 'Website', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
