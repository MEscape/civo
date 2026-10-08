import { instantKeys, parseRecord } from '../models/field-schema';

import type { ContentDefinition, ContentRule } from '../models/content-definition';
import type { Infer, Shape } from '../models/field-schema';

const INITIAL_VERSION = 1;

export interface ContentSpec<S extends Shape> {
  readonly version?: number;
  readonly shape: S;
  readonly rule?: ContentRule<Infer<S>>;
}

/**
 * The second step of a definition. Placeholder records are supplied here, once
 * the shape is fixed, so their literal values (an enum member, a weekday) are
 * checked against it instead of widening to `string`. A definition cannot be
 * finished without them.
 */
export interface ContentBuilder<S extends Shape> {
  withSample(sample: (now: string) => ReadonlyArray<Infer<S>>): ContentDefinition<Infer<S>>;
}

/** A field is required when it rejects an absent value. */
function isRequired(shape: Shape, key: string): boolean {
  return shape[key]?.parse(undefined).ok === false;
}

/**
 * Builds a content definition from its shape. The shape is written once:
 * the record type, the validation, the instant fields and the field lists
 * all derive from it.
 */
export function defineContent<S extends Shape>(spec: ContentSpec<S>): ContentBuilder<S> {
  const fieldNames = Object.keys(spec.shape);
  return {
    withSample: (sample) => ({
      version: spec.version ?? INITIAL_VERSION,
      parse: (raw) => parseRecord(spec.shape, raw),
      instantFields: instantKeys(spec.shape),
      fieldNames,
      requiredFieldNames: fieldNames.filter((key) => isRequired(spec.shape, key)),
      rule: spec.rule ?? {},
      sample,
    }),
  };
}
