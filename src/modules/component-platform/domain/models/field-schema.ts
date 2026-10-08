import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';
import { isPlainObject, isRelativePath, isUnsafePathSegment, isValidUrl } from '@lib/utils';

import {
  COMPONENT_PLATFORM_VALIDATION_CODES as CODES,
  createContentErrorBag,
} from '../errors/component-platform-errors';

import type { ComponentPlatformValidationCode } from '../errors/component-platform-errors';

/**
 * A small, declarative validation engine for untrusted values.
 *
 * Zod is a presentation-layer tool (rule 6); this module has no Server
 * Action or HTTP boundary, yet it must validate two kinds of untrusted data
 * in the domain: records mapped from third-party APIs and props stored by
 * editors. One engine serves both, and each field is described exactly once:
 * the same description yields the TypeScript type, the validation, and (for
 * props) the editor control.
 */

export interface FieldFailure {
  readonly code: ComponentPlatformValidationCode;
  /** Dotted path below the validated value; empty for the value itself. */
  readonly path: string;
}

export type FieldOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly failures: readonly FieldFailure[] };

export interface FieldSchema<T> {
  /** Marks a point in time, so a boundary can convert it before validation. */
  readonly isInstant: boolean;
  readonly parse: (raw: unknown) => FieldOutcome<T>;
}

export type Shape = Readonly<Record<string, FieldSchema<unknown>>>;

type Output<F> = F extends FieldSchema<infer T> ? T : never;

type OptionalKeys<S extends Shape> = {
  [K in keyof S]-?: undefined extends Output<S[K]> ? K : never;
}[keyof S];

/** A key whose field accepts `undefined` becomes an optional key. */
export type Infer<S extends Shape> = {
  readonly [K in Exclude<keyof S, OptionalKeys<S>>]: Output<S[K]>;
} & {
  readonly [K in OptionalKeys<S>]?: Exclude<Output<S[K]>, undefined>;
};

const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pass<T>(value: T): FieldOutcome<T> {
  return { ok: true, value };
}

function fail(code: ComponentPlatformValidationCode, path = ''): FieldOutcome<never> {
  return { ok: false, failures: [{ code, path }] };
}

function schema<T>(parse: (raw: unknown) => FieldOutcome<T>, isInstant = false): FieldSchema<T> {
  return { isInstant, parse };
}

export interface TextOptions {
  readonly max: number;
  /** `1` makes the value required; the default accepts an empty string. */
  readonly min?: number;
  readonly pattern?: RegExp;
  readonly trim?: boolean;
}

export function text(options: TextOptions): FieldSchema<string> {
  const { max, min = 0, pattern, trim = false } = options;
  return schema((raw) => {
    if (typeof raw !== 'string') {
      return fail(CODES.typeInvalid);
    }
    const value = trim ? raw.trim() : raw;
    if (value.length < min) {
      return fail(min <= 1 ? CODES.required : CODES.tooShort);
    }
    if (value.length > max) {
      return fail(CODES.tooLong);
    }
    if (pattern !== undefined && !pattern.test(value)) {
      return fail(CODES.formatInvalid);
    }
    return pass(value);
  });
}

export function email(max: number): FieldSchema<string> {
  return text({ max, pattern: EMAIL_PATTERN });
}

export interface UrlOptions {
  readonly max: number;
  /** A same-origin path such as `/leistungen/x` is accepted next to http(s). */
  readonly allowRelative: boolean;
}

/**
 * Only http(s) or, when allowed, a same-origin path. A plain URL parse would
 * also accept script-bearing schemes, and these values end up in `href` and
 * `src` attributes of public pages.
 */
export function url(options: UrlOptions): FieldSchema<string> {
  const { max, allowRelative } = options;
  return schema((raw) => {
    if (typeof raw !== 'string') {
      return fail(CODES.typeInvalid);
    }
    if (raw.length > max) {
      return fail(CODES.tooLong);
    }
    const safe = isValidUrl(raw) || (allowRelative && isRelativePath(raw));
    return safe ? pass(raw) : fail(CODES.urlUnsafe);
  });
}

/**
 * Canonical point in time: ISO 8601, UTC, millisecond precision. One exact
 * shape makes plain string comparison equal to chronological comparison, so
 * the domain needs no date arithmetic. Anything else is converted at the
 * infrastructure boundary before it reaches this schema.
 */
export function instant(): FieldSchema<string> {
  return schema(
    (raw) =>
      typeof raw === 'string' && INSTANT_PATTERN.test(raw) ? pass(raw) : fail(CODES.instantInvalid),
    true,
  );
}

export interface NumberOptions {
  readonly min?: number;
  readonly max?: number;
  readonly integer?: boolean;
}

export function number(options: NumberOptions = {}): FieldSchema<number> {
  const {
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    integer = false,
  } = options;
  return schema((raw) => {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return fail(CODES.typeInvalid);
    }
    if (integer && !Number.isInteger(raw)) {
      return fail(CODES.typeInvalid);
    }
    return raw < min || raw > max ? fail(CODES.outOfRange) : pass(raw);
  });
}

export function boolean(): FieldSchema<boolean> {
  return schema((raw) => (typeof raw === 'boolean' ? pass(raw) : fail(CODES.typeInvalid)));
}

export function oneOf<const V extends string | number>(values: readonly V[]): FieldSchema<V> {
  return schema((raw) => {
    const match = values.find((value) => value === raw);
    return match === undefined ? fail(CODES.optionUnknown) : pass(match);
  });
}

function prefixed(failures: readonly FieldFailure[], segment: string): FieldFailure[] {
  return failures.map(({ code, path }) => ({
    code,
    path: path === '' ? segment : `${segment}.${path}`,
  }));
}

export function list<T>(item: FieldSchema<T>, max: number): FieldSchema<readonly T[]> {
  return schema((raw) => {
    if (!Array.isArray(raw)) {
      return fail(CODES.typeInvalid);
    }
    if (raw.length > max) {
      return fail(CODES.tooMany);
    }

    const values: T[] = [];
    const failures: FieldFailure[] = [];
    raw.forEach((element: unknown, index) => {
      const outcome = item.parse(element);
      if (outcome.ok) {
        values.push(outcome.value);
      } else {
        failures.push(...prefixed(outcome.failures, String(index)));
      }
    });
    return failures.length > 0 ? { ok: false, failures } : pass(values);
  });
}

export interface OpaqueRecordOptions {
  /** Upper bound on every nested value, so one record cannot carry an unbounded payload. */
  readonly maxNodes: number;
}

/**
 * A nested JSON object whose inner shape another module owns (a GeoJSON
 * geometry, validated by the map). Only "a plain object of JSON values, no
 * larger than `maxNodes`" is checked here.
 */
export function opaqueRecord(
  options: OpaqueRecordOptions,
): FieldSchema<Readonly<Record<string, unknown>>> {
  return schema((raw) => {
    if (!isPlainObject(raw)) {
      return fail(CODES.typeInvalid);
    }
    let remaining = options.maxNodes;
    const pending: unknown[] = [raw];
    while (pending.length > 0) {
      const node = pending.pop();
      remaining -= 1;
      if (remaining < 0) {
        return fail(CODES.tooMany);
      }
      if (Array.isArray(node)) {
        pending.push(...(node as unknown[]));
      } else if (isPlainObject(node)) {
        pending.push(...Object.values(node));
      }
    }
    return pass(raw);
  });
}

export interface ScalarMapOptions {
  readonly maxEntries: number;
  readonly maxKeyLength: number;
  readonly maxTextLength: number;
}

/**
 * Free-form record properties (a municipality's own fields). Only text,
 * finite numbers and booleans survive: nested values, nulls and oversized
 * entries are dropped one by one, so a single odd field never costs the
 * whole record. Not an object at all is a type error.
 */
export function scalarMap(
  options: ScalarMapOptions,
): FieldSchema<Readonly<Record<string, string | number | boolean>>> {
  const { maxEntries, maxKeyLength, maxTextLength } = options;
  return schema((raw) => {
    if (!isPlainObject(raw)) {
      return fail(CODES.typeInvalid);
    }
    const kept: Record<string, string | number | boolean> = {};
    let count = 0;
    for (const [key, value] of Object.entries(raw)) {
      const isUsable =
        key.length > 0 &&
        key.length <= maxKeyLength &&
        !isUnsafePathSegment(key) &&
        (typeof value === 'boolean' ||
          (typeof value === 'number' && Number.isFinite(value)) ||
          (typeof value === 'string' && value.length <= maxTextLength));
      if (isUsable && count < maxEntries) {
        kept[key] = value;
        count += 1;
      }
    }
    return pass(kept);
  });
}

/** Absent (`undefined`) is acceptable; anything else must satisfy `inner`. */
export function optional<T>(inner: FieldSchema<T>): FieldSchema<T | undefined> {
  return schema((raw) => (raw === undefined ? pass(undefined) : inner.parse(raw)), inner.isInstant);
}

/** Absent becomes `value`; a present but invalid value still fails. */
export function withDefault<T>(inner: FieldSchema<T>, value: T): FieldSchema<T> {
  return schema((raw) => (raw === undefined ? pass(value) : inner.parse(raw)), inner.isInstant);
}

/**
 * An invalid value becomes `value` instead of failing. For classifications
 * that third-party APIs spell in their own vocabulary: an unknown spelling
 * must not cost the municipality the whole record.
 */
export function withFallback<T>(inner: FieldSchema<T>, value: T): FieldSchema<T> {
  return schema((raw) => {
    const outcome = inner.parse(raw);
    return outcome.ok ? outcome : pass(value);
  }, inner.isInstant);
}

/**
 * Validates every field of `shape` and collects all failures in one pass.
 * Unknown keys are dropped; a missing optional key stays missing.
 */
export function parseShape<S extends Shape>(shape: S, raw: unknown): FieldOutcome<Infer<S>> {
  if (!isPlainObject(raw)) {
    return fail(CODES.typeInvalid);
  }

  const value: Record<string, unknown> = {};
  const failures: FieldFailure[] = [];
  for (const [key, field] of Object.entries(shape)) {
    const outcome = field.parse(raw[key]);
    if (!outcome.ok) {
      failures.push(...prefixed(outcome.failures, key));
    } else if (outcome.value !== undefined) {
      value[key] = outcome.value;
    }
  }
  if (failures.length > 0) {
    return { ok: false, failures };
  }

  // `value` holds exactly the keys `Infer<S>` describes; TypeScript cannot
  // follow a mapped type through a runtime loop.

  return pass(value as Infer<S>);
}

/** A nested record inside a record, e.g. a council member. */
export function object<S extends Shape>(shape: S): FieldSchema<Infer<S>> {
  return schema((raw) => parseShape(shape, raw));
}

/** Top-level fields of `shape` that hold a point in time. */
export function instantKeys(shape: Shape): readonly string[] {
  return Object.entries(shape)
    .filter(([, field]) => field.isInstant)
    .map(([key]) => key);
}

/** Validates a record and reports every failing field path with its code. */
export function parseRecord<S extends Shape>(
  shape: S,
  raw: unknown,
): AppResult<Infer<S>, ValidationAppError> {
  const outcome = parseShape(shape, raw);
  if (outcome.ok) {
    return ok(outcome.value);
  }

  const bag = createContentErrorBag();
  for (const failure of outcome.failures) {
    bag.add(failure.path, failure.code);
  }
  return err(bag.toError());
}
