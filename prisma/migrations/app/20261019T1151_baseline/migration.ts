#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/02d2cc979bf21c8eff202f310eca267162b4257d8328d4d16022d5fc7d2ec69d/contract';
import endContract from '../../snapshots/02d2cc979bf21c8eff202f310eca267162b4257d8328d4d16022d5fc7d2ec69d/contract.json' with { type: 'json' };
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

/** Tables whose `updatedAt` the database stamps when the writer did not. `Booking` is left out: its `updatedAt` is the compare-and-swap token the repository sets itself. */
const STAMPED_TABLES = [
  'Website',
  'Page',
  'PageConfig',
  'DataSource',
  'Dataset',
  'BookingLocation',
  'BookableResource',
  'BookableService',
] as const;

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'AuditEntry',
        columns: [
          col('actorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('actorKind', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('details', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
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
            'AuditEntry_details_rule_e50db189',
            'jsonb_typeof("details") = \'object\'',
          ),
          checkExpression(
            'AuditEntry_label_rule_678d1d4c',
            'char_length("source") BETWEEN 1 AND 64 AND char_length("type") BETWEEN 1 AND 128',
          ),
          checkExpression(
            'AuditEntry_member_actor_check_98aa2b3c',
            '("actorKind" = \'MEMBER\') = ("actorId" IS NOT NULL)',
          ),
          checkExpression('AuditEntry_severity_check_f199a339', "\"severity\" IN ('INFO', 'WARN')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'BookableResource',
        columns: [
          col('assignedActorId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('availability', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
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
          col('managerChange', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('skills', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
            'BookableResource_actor_rule_e8fa4523',
            '"assignedActorId" IS NULL OR char_length("assignedActorId") BETWEEN 1 AND 128',
          ),
          checkExpression(
            'BookableResource_capacity_rule_d4b0b053',
            '"capacity" IS NULL OR "capacity" BETWEEN 1 AND 10000',
          ),
          checkExpression(
            'BookableResource_name_rule_38e74a36',
            'char_length("name") BETWEEN 1 AND 120',
          ),
          checkExpression(
            'BookableResource_skills_rule_581142a0',
            'jsonb_typeof("skills") = \'array\'',
          ),
          checkExpression(
            'BookableResource_type_check_8d6e2feb',
            "\"type\" IN ('employee', 'room', 'office', 'service-desk', 'sports-field', 'meeting-room', 'vehicle', 'equipment', 'facility', 'workstation', 'other')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'BookableService',
        columns: [
          col('availability', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('cancellation', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
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
          col('information', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('instructions', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('locationIds', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
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
          col('requiredDocuments', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('requirements', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('rescheduling', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('slotIntervalMinutes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
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
            'BookableService_buffers_rule_53109094',
            '"preparationMinutes" BETWEEN 0 AND 240 AND "cleanupMinutes" BETWEEN 0 AND 240',
          ),
          checkExpression(
            'BookableService_category_rule_e6f05208',
            '"category" IS NULL OR char_length("category") <= 64',
          ),
          checkExpression(
            'BookableService_description_rule_c341d9ba',
            '"description" IS NULL OR char_length("description") <= 2000',
          ),
          checkExpression(
            'BookableService_instructions_rule_7941d6d7',
            '"instructions" IS NULL OR char_length("instructions") <= 2000',
          ),
          checkExpression(
            'BookableService_lists_rule_8a614c43',
            'jsonb_typeof("locationIds") = \'array\' AND jsonb_typeof("requirements") = \'array\' AND jsonb_typeof("information") = \'array\' AND jsonb_typeof("requiredDocuments") = \'array\'',
          ),
          checkExpression(
            'BookableService_name_rule_38e74a36',
            'char_length("name") BETWEEN 1 AND 120',
          ),
          checkExpression(
            'BookableService_participants_rule_e342c26a',
            '"participantsPerBooking" BETWEEN 1 AND 500 AND "participantsPerSession" BETWEEN "participantsPerBooking" AND 500',
          ),
          checkExpression(
            'BookableService_rules_rule_68aba18c',
            'jsonb_typeof("cancellation") = \'object\' AND jsonb_typeof("rescheduling") = \'object\'',
          ),
          checkExpression(
            'BookableService_timing_rule_998915e5',
            '"durationMinutes" BETWEEN 5 AND 1440 AND "slotIntervalMinutes" BETWEEN 5 AND 240',
          ),
          checkExpression(
            'BookableService_window_rule_0c76c76e',
            '"noticeMinutes" BETWEEN 0 AND 525600 AND "horizonDays" BETWEEN 1 AND 730',
          ),
        ],
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
          col('customer', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
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
            'Booking_cancelled_rule_2f2cfb7b',
            '("status" = \'CANCELLED\') = ("cancelledAt" IS NOT NULL AND "cancelledBy" IS NOT NULL)',
          ),
          checkExpression(
            'Booking_customer_known_rule_47752ebc',
            "\"status\" NOT IN ('CONFIRMED', 'COMPLETED', 'NO_SHOW') OR \"customer\" IS NOT NULL",
          ),
          checkExpression(
            'Booking_customer_rule_4b39e918',
            '"customer" IS NULL OR jsonb_typeof("customer") = \'object\'',
          ),
          checkExpression(
            'Booking_group_size_rule_69eea88d',
            '"participants" >= 1 AND "participants" <= "sessionCapacity"',
          ),
          checkExpression(
            'Booking_reference_rule_1ba81916',
            '"reference" ~ \'^[0-9A-HJKMNP-TV-Z]{10}$\'',
          ),
          checkExpression('Booking_reschedules_rule_e98165eb', '"rescheduleCount" >= 0'),
          checkExpression(
            'Booking_span_check_956c7fbe',
            '"start" < "end" AND "occupiedStart" <= "start" AND "end" <= "occupiedEnd"',
          ),
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
          col('openingHours', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('staffHours', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('tenantId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timeZone', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
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
            'BookingLocation_address_rule_1bffa6f4',
            '"address" IS NULL OR char_length("address") <= 300',
          ),
          checkExpression(
            'BookingLocation_hours_rule_14882546',
            'jsonb_typeof("openingHours") = \'object\' AND ("staffHours" IS NULL OR jsonb_typeof("staffHours") = \'object\')',
          ),
          checkExpression(
            'BookingLocation_name_rule_38e74a36',
            'char_length("name") BETWEEN 1 AND 120',
          ),
          checkExpression(
            'BookingLocation_zone_rule_9089714f',
            'char_length("timeZone") BETWEEN 1 AND 64',
          ),
        ],
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
          col('websiteId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['bookingId', 'resourceId']),
          checkExpression('BookingResource_span_check_62352ed1', '"occupiedStart" < "occupiedEnd"'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'DataSource',
        columns: [
          col('config', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
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
          checkExpression('DataSource_name_rule_ec45dfca', 'char_length("name") BETWEEN 2 AND 100'),
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
          col('mapping', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('path', 'text', { codecRef: { codecId: 'pg/text@1' } }),
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
            'Dataset_kind_rule_50c206e9',
            'char_length("canonicalKind") BETWEEN 1 AND 64',
          ),
          checkExpression('Dataset_name_rule_ec45dfca', 'char_length("name") BETWEEN 2 AND 100'),
          checkExpression(
            'Dataset_path_rule_784264d8',
            '"path" IS NULL OR ("path" LIKE \'/%\' AND "path" NOT LIKE \'//%\' AND char_length("path") <= 500)',
          ),
          checkExpression(
            'Dataset_slug_rule_5079bb33',
            '"slug" ~ \'^[a-z0-9-]+$\' AND char_length("slug") <= 50',
          ),
          checkExpression(
            'Dataset_status_check_ff3434bd',
            "\"status\" IN ('UNKNOWN', 'OK', 'ERROR')",
          ),
        ],
      }),
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
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Invitation_email_rule_b834da03',
            'char_length("email") BETWEEN 3 AND 254',
          ),
          checkExpression(
            'Invitation_platform_rule_ff43ec02',
            '("role" = \'platform_admin\') = ("tenantId" = \'platform\')',
          ),
          checkExpression(
            'Invitation_role_check_62bd3a39',
            "\"role\" IN ('admin', 'editor', 'contributor', 'viewer', 'employee', 'platform_admin')",
          ),
          checkExpression(
            'Invitation_tenant_rule_0516ac63',
            '"tenantId" ~ \'^[A-Za-z0-9_-]{1,64}$\'',
          ),
          checkExpression('Invitation_token_rule_eadbb071', '"tokenHash" ~ \'^[0-9a-f]{64}$\''),
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
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Membership_actor_rule_98c52012',
            'char_length("actorId") BETWEEN 1 AND 128',
          ),
          checkExpression(
            'Membership_platform_rule_ff43ec02',
            '("role" = \'platform_admin\') = ("tenantId" = \'platform\')',
          ),
          checkExpression(
            'Membership_role_check_62bd3a39',
            "\"role\" IN ('admin', 'editor', 'contributor', 'viewer', 'employee', 'platform_admin')",
          ),
          checkExpression(
            'Membership_tenant_rule_0516ac63',
            '"tenantId" ~ \'^[A-Za-z0-9_-]{1,64}$\'',
          ),
        ],
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
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Page_path_rule_8813a6c7',
            '("path" = \'\' OR "path" ~ \'^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$\') AND char_length("path") <= 200',
          ),
          checkExpression('Page_title_rule_9831bb81', 'char_length("title") BETWEEN 2 AND 120'),
          checkExpression('Page_version_rule_efd86c31', '"version" >= 1'),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'PageConfig',
        columns: [
          col('content', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
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
          checkExpression('PageConfig_version_rule_efd86c31', '"version" >= 1'),
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
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Website_description_rule_e354da0e',
            '"description" IS NULL OR char_length("description") <= 500',
          ),
          checkExpression('Website_name_rule_ccdd0785', 'char_length("name") BETWEEN 2 AND 120'),
          checkExpression(
            'Website_slug_rule_ead2f3ca',
            '"slug" ~ \'^[a-z0-9]+(-[a-z0-9]+)*$\' AND char_length("slug") <= 80',
          ),
          checkExpression(
            'Website_template_rule_3c5a908f',
            'char_length("templateKey") BETWEEN 1 AND 64',
          ),
          checkExpression('Website_tenant_is_website_check_34a4fea9', '"id" = "tenantId"'),
        ],
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
          col('plan', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
          col('proposedBy', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('resolutions', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
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
            'WebsiteMigration_applied_rule_bd7c0272',
            '("status" = \'APPLIED\') = ("appliedAt" IS NOT NULL)',
          ),
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
          col('changes', 'jsonb', { codecRef: { codecId: 'pg/jsonb@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('publishedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('publishedBy', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('releaseNumber', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('snapshot', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
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
            'WebsiteRelease_hash_rule_962e3d92',
            '"snapshotHash" ~ \'^[0-9a-f]{64}$\'',
          ),
          checkExpression(
            'WebsiteRelease_note_rule_f768e023',
            '"note" IS NULL OR char_length("note") <= 200',
          ),
          checkExpression('WebsiteRelease_number_rule_d77b088c', '"releaseNumber" >= 1'),
          checkExpression(
            'WebsiteRelease_published_rule_d776d660',
            '("status" IN (\'PUBLISHED\', \'ROLLED_BACK\')) = ("publishedAt" IS NOT NULL)',
          ),
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
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'WebsiteTheme_colors_rule_d76d4915',
            '"primaryColor" ~ \'^#[0-9a-fA-F]{6}$\' AND "secondaryColor" ~ \'^#[0-9a-fA-F]{6}$\' AND "accentColor" ~ \'^#[0-9a-fA-F]{6}$\'',
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'BookableResource',
        constraint: 'BookableResource_id_websiteId_key',
        columns: ['id', 'websiteId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'BookableService',
        constraint: 'BookableService_id_websiteId_key',
        columns: ['id', 'websiteId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Booking',
        constraint: 'Booking_reference_key',
        columns: ['reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Booking',
        constraint: 'Booking_id_websiteId_key',
        columns: ['id', 'websiteId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'BookingLocation',
        constraint: 'BookingLocation_id_websiteId_key',
        columns: ['id', 'websiteId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Dataset',
        constraint: 'Dataset_dataSourceId_slug_key',
        columns: ['dataSourceId', 'slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Invitation',
        constraint: 'Invitation_tokenHash_key',
        columns: ['tokenHash'],
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
        table: 'WebsiteRelease',
        constraint: 'WebsiteRelease_id_websiteId_key',
        columns: ['id', 'websiteId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'WebsiteTheme',
        constraint: 'WebsiteTheme_websiteId_key',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_occurredAt_idx_c6b89167',
        columns: ['occurredAt'],
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
        index: 'AuditEntry_websiteId_occurredAt_idx_0705c2f4',
        columns: ['websiteId', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'AuditEntry',
        index: 'AuditEntry_websiteId_source_occurredAt_idx_6b615d77',
        columns: ['websiteId', 'source', 'occurredAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookableResource',
        index: 'BookableResource_assignee_idx_796b7750',
        columns: ['tenantId', 'assignedActorId'],
        extras: { where: '"assignedActorId" IS NOT NULL' },
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookableResource',
        index: 'BookableResource_locationId_websiteId_idx_3128d57b',
        columns: ['locationId', 'websiteId'],
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
        index: 'BookableService_websiteId_tenantId_idx_ac8953f0',
        columns: ['websiteId', 'tenantId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_held_idx_f16041d9',
        columns: ['websiteId', 'holdExpiresAt'],
        extras: { where: '"status" = \'HELD\'' },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_locationId_websiteId_idx_3128d57b',
        columns: ['locationId', 'websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_serviceId_websiteId_idx_dff1d9a6',
        columns: ['serviceId', 'websiteId'],
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
        index: 'Booking_websiteId_customerEmail_idx_b6a5d348',
        columns: ['websiteId', 'customerEmail'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_websiteId_occupiedStart_idx_69c19ff2',
        columns: ['websiteId', 'occupiedStart'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Booking',
        index: 'Booking_websiteId_start_idx_96c4ebf4',
        columns: ['websiteId', 'start'],
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
        index: 'BookingResource_bookingId_websiteId_idx_1ccc460f',
        columns: ['bookingId', 'websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'BookingResource',
        index: 'BookingResource_resourceId_occupiedStart_idx_e88cdc78',
        columns: ['resourceId', 'occupiedStart'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'DataSource',
        index: 'DataSource_websiteId_idx_aa7167ce',
        columns: ['websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invitation',
        index: 'Invitation_open_idx_8f1ab84a',
        columns: ['tenantId', 'createdAt'],
        extras: { where: '"acceptedAt" IS NULL' },
      }),
      this.createIndex({
        schema: 'public',
        table: 'Invitation',
        index: 'Invitation_tenantId_email_idx_88e149c0',
        columns: ['tenantId', 'email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Membership',
        index: 'Membership_tenantId_role_idx_c3ec5d48',
        columns: ['tenantId', 'role'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteMigration',
        index: 'WebsiteMigration_sourceReleaseId_websiteId_idx_7795b2f9',
        columns: ['sourceReleaseId', 'websiteId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'WebsiteMigration',
        index: 'WebsiteMigration_websiteId_createdAt_idx_5579a8b3',
        columns: ['websiteId', 'createdAt'],
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
          name: 'BookableResource_locationId_websiteId_fkey',
          columns: ['locationId', 'websiteId'],
          references: { schema: 'public', table: 'BookingLocation', columns: ['id', 'websiteId'] },
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
          name: 'Booking_serviceId_websiteId_fkey',
          columns: ['serviceId', 'websiteId'],
          references: { schema: 'public', table: 'BookableService', columns: ['id', 'websiteId'] },
          onDelete: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Booking',
        foreignKey: {
          name: 'Booking_locationId_websiteId_fkey',
          columns: ['locationId', 'websiteId'],
          references: { schema: 'public', table: 'BookingLocation', columns: ['id', 'websiteId'] },
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
          name: 'BookingResource_bookingId_websiteId_fkey',
          columns: ['bookingId', 'websiteId'],
          references: { schema: 'public', table: 'Booking', columns: ['id', 'websiteId'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'BookingResource',
        foreignKey: {
          name: 'BookingResource_resourceId_websiteId_fkey',
          columns: ['resourceId', 'websiteId'],
          references: { schema: 'public', table: 'BookableResource', columns: ['id', 'websiteId'] },
          onDelete: 'restrict',
        },
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
          name: 'Website_publishedReleaseId_id_fkey',
          columns: ['publishedReleaseId', 'id'],
          references: { schema: 'public', table: 'WebsiteRelease', columns: ['id', 'websiteId'] },
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
          name: 'WebsiteMigration_sourceReleaseId_websiteId_fkey',
          columns: ['sourceReleaseId', 'websiteId'],
          references: { schema: 'public', table: 'WebsiteRelease', columns: ['id', 'websiteId'] },
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

      // ── updatedAt ──────────────────────────────────────────────────────────
      // A writer that sets `updatedAt` keeps its value; one that leaves it alone gets the
      // time of the write, so no repository can forget to move it.
      statement(
        'function.set_updated_at',
        'Create set_updated_at()',
        `CREATE FUNCTION "public"."set_updated_at"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."updatedAt" IS NOT DISTINCT FROM OLD."updatedAt" THEN
    NEW."updatedAt" := now();
  END IF;
  RETURN NEW;
END
$$`,
      ),
      ...STAMPED_TABLES.map((table) =>
        statement(
          `trigger.${table}_set_updated_at`,
          `Stamp updatedAt on ${table}`,
          `CREATE TRIGGER "${table}_set_updated_at" BEFORE UPDATE ON "public"."${table}" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"()`,
        ),
      ),

      // ── Append-only and immutable rows ─────────────────────────────────────
      statement(
        'function.refuse_update',
        'Create refuse_update()',
        `CREATE FUNCTION "public"."refuse_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END
$$`,
      ),
      statement(
        'trigger.AuditEntry_append_only',
        'The audit trail is append-only: rows can be deleted (retention, website) but never changed',
        'CREATE TRIGGER "AuditEntry_append_only" BEFORE UPDATE ON "public"."AuditEntry" FOR EACH ROW EXECUTE FUNCTION "public"."refuse_update"()',
      ),
      statement(
        'function.freeze_release',
        'Create freeze_release()',
        `CREATE FUNCTION "public"."freeze_release"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."websiteId" IS DISTINCT FROM OLD."websiteId"
    OR NEW."releaseNumber" IS DISTINCT FROM OLD."releaseNumber"
    OR NEW."snapshot" IS DISTINCT FROM OLD."snapshot"
    OR NEW."snapshotHash" IS DISTINCT FROM OLD."snapshotHash"
    OR NEW."note" IS DISTINCT FROM OLD."note"
    OR NEW."changes" IS DISTINCT FROM OLD."changes"
    OR NEW."publishedBy" IS DISTINCT FROM OLD."publishedBy"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
    OR (OLD."publishedAt" IS NOT NULL AND NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt") THEN
    RAISE EXCEPTION 'a release is immutable: only its status can change' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$$`,
      ),
      statement(
        'trigger.WebsiteRelease_frozen',
        'A release is an immutable snapshot: only its status moves',
        'CREATE TRIGGER "WebsiteRelease_frozen" BEFORE UPDATE ON "public"."WebsiteRelease" FOR EACH ROW EXECUTE FUNCTION "public"."freeze_release"()',
      ),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
