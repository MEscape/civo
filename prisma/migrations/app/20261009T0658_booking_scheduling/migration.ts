#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/33c6d679b6ee43881825cfa03e7313e5db728b44a1475cf59c72cab7f92f8761/contract';
import endContract from '../../snapshots/33c6d679b6ee43881825cfa03e7313e5db728b44a1475cf59c72cab7f92f8761/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c7c52e3229880c553d3655940f128f9ac431dbc469c0a3e8aef493807391b6cc/contract';
import startContract from '../../snapshots/c7c52e3229880c553d3655940f128f9ac431dbc469c0a3e8aef493807391b6cc/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
  rawSql,
} from '@prisma/orm-postgres/migration';

/** A statement the contract cannot express, run as one additive step. */
function statement(id: string, label: string, sql: string) {
  return rawSql({
    id,
    label,
    operationClass: 'additive',
    target: { id: 'postgres' },
    precheck: [],
    execute: [{ description: label, sql, params: [] }],
    postcheck: [],
  });
}

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'BookableResource',
        columns: [
          col('availability', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('capacity', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('locationId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('skills', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'BookableService',
        columns: [
          col('availability', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('cancellation', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('category', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('cleanupMinutes', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('durationMinutes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('horizonDays', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('information', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('instructions', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('locationIds', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('noticeMinutes', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('participantsPerBooking', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('participantsPerSession', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('preparationMinutes', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('requiredDocuments', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('requirements', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('rescheduling', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('slotIntervalMinutes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Booking',
        columns: [
          col('cancelledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('cancelledBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('customer', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('customerEmail', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('end', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('holdExpiresAt', 'timestamptz', {
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('locationId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('occupiedEnd', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('occupiedStart', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('participants', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rescheduleCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('serviceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sessionCapacity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sessionKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('start', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Booking_status_check_db2290c3',
            "\"status\" IN ('HELD', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW', 'EXPIRED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'BookingLocation',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('openingHours', 'json', { notNull: true, codecRef: { codecId: 'pg/json@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timeZone', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'BookingResource',
        columns: [
          col('bookingId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', { notNull: true, codecRef: { codecId: 'pg/bool@1' } }),
          col('occupiedEnd', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('occupiedStart', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('resourceId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sessionKey', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['bookingId', 'resourceId'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Booking',
        constraint: 'Booking_reference_key',
        columns: ['reference'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookableResource',
        index: 'BookableResource_locationId_idx_7aae3038',
        columns: ['locationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookableResource',
        index: 'BookableResource_websiteId_idx_aa7167ce',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookableResource',
        index: 'BookableResource_websiteId_tenantId_idx_ac8953f0',
        columns: ['websiteId', 'tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookableService',
        index: 'BookableService_websiteId_idx_aa7167ce',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookableService',
        index: 'BookableService_websiteId_tenantId_idx_ac8953f0',
        columns: ['websiteId', 'tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_customerEmail_idx_7ee6d307',
        columns: ['customerEmail'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_locationId_idx_7aae3038',
        columns: ['locationId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_serviceId_idx_b5d9acbf',
        columns: ['serviceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_sessionKey_idx_f9805107',
        columns: ['sessionKey'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_status_holdExpiresAt_idx_b5009e9f',
        columns: ['status', 'holdExpiresAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_websiteId_start_idx_96c4ebf4',
        columns: ['websiteId', 'start'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_websiteId_tenantId_idx_ac8953f0',
        columns: ['websiteId', 'tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookingLocation',
        index: 'BookingLocation_websiteId_idx_aa7167ce',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookingLocation',
        index: 'BookingLocation_websiteId_tenantId_idx_ac8953f0',
        columns: ['websiteId', 'tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookingResource',
        index: 'BookingResource_bookingId_idx_17848f4a',
        columns: ['bookingId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookingResource',
        index: 'BookingResource_resourceId_idx_72964925',
        columns: ['resourceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookingResource',
        index: 'BookingResource_resourceId_occupiedStart_idx_e88cdc78',
        columns: ['resourceId', 'occupiedStart'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BookableResource',
        foreignKey: {
          name: 'BookableResource_websiteId_tenantId_fkey',
          columns: ['websiteId', 'tenantId'],
          references: { schema: 'public', table: 'Website', columns: ['id', 'tenantId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BookableResource',
        foreignKey: {
          name: 'BookableResource_locationId_fkey',
          columns: ['locationId'],
          references: { schema: 'public', table: 'BookingLocation', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BookableService',
        foreignKey: {
          name: 'BookableService_websiteId_tenantId_fkey',
          columns: ['websiteId', 'tenantId'],
          references: { schema: 'public', table: 'Website', columns: ['id', 'tenantId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_websiteId_tenantId_fkey',
          columns: ['websiteId', 'tenantId'],
          references: { schema: 'public', table: 'Website', columns: ['id', 'tenantId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_serviceId_fkey',
          columns: ['serviceId'],
          references: { schema: 'public', table: 'BookableService', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_locationId_fkey',
          columns: ['locationId'],
          references: { schema: 'public', table: 'BookingLocation', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BookingLocation',
        foreignKey: {
          name: 'BookingLocation_websiteId_tenantId_fkey',
          columns: ['websiteId', 'tenantId'],
          references: { schema: 'public', table: 'Website', columns: ['id', 'tenantId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BookingResource',
        foreignKey: {
          name: 'BookingResource_bookingId_fkey',
          columns: ['bookingId'],
          references: { schema: 'public', table: 'Booking', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BookingResource',
        foreignKey: {
          name: 'BookingResource_resourceId_fkey',
          columns: ['resourceId'],
          references: { schema: 'public', table: 'BookableResource', columns: ['id'] },
          onDelete: 'restrict',
        },
      }),

      // ── Double-booking protection ──────────────────────────────────────────
      // The application checks availability first (for good error messages); this
      // constraint is what makes a double booking impossible even when two requests
      // race past that check. Two LIVE rows for the same resource whose occupied
      // spans overlap are refused, unless they belong to the same session (several
      // bookings sharing one class or one room). A live hold counts until a
      // repository sweeps it, so expired holds are released before every insert.
      statement(
        'extension.btree_gist',
        'Enable btree_gist (equality and ranges in one exclusion constraint)',
        'CREATE EXTENSION IF NOT EXISTS btree_gist',
      ),
      statement(
        'constraint.BookingResource_no_overlap',
        'Forbid overlapping live holds on one resource across different sessions',
        'ALTER TABLE "public"."BookingResource" ADD CONSTRAINT "BookingResource_no_overlap" EXCLUDE USING gist ("resourceId" WITH =, tstzrange("occupiedStart", "occupiedEnd", \'[)\') WITH &&, "sessionKey" WITH <>) WHERE ("isActive")',
      ),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
