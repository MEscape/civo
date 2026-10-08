import type { ValidationAppError } from '@lib/errors';
import type { AppResult } from '@lib/result';

/** How one kind of content is filtered, ordered and categorised for display. */
export interface ContentRule<R> {
  /** Drops records that are no longer relevant (past events, inactive alerts). `now` is a canonical instant. */
  readonly isRelevant?: (item: R, now: string) => boolean;
  readonly compare?: (first: R, second: R) => number;
  /** The field a `category` filter matches against, when the kind has one. */
  readonly categoryOf?: (item: R) => string | undefined;
}

/**
 * Everything the platform knows about one canonical shape, declared in one
 * place: the contract, its version, how it is selected for display and what
 * a placeholder looks like.
 *
 * `version` is bumped only for a breaking change (a renamed or removed
 * field, a changed type); adding an optional field is not breaking. A
 * published release pins the version its components were built against.
 */
export interface ContentDefinition<R> {
  readonly version: number;
  /** Total over unknown input: a record that breaks the contract is an error, never a partial value. */
  readonly parse: (raw: unknown) => AppResult<R, ValidationAppError>;
  /**
   * Top-level fields holding a point in time. The infrastructure boundary
   * converts them to the canonical instant form before `parse`, so the
   * contract itself stays strict.
   */
  readonly instantFields: readonly string[];
  /** Names of every field the contract reads, for checking against the mapping targets. */
  readonly fieldNames: readonly string[];
  /** Names of the fields a record cannot do without (no default, not optional). */
  readonly requiredFieldNames: readonly string[];
  readonly rule: ContentRule<R>;
  /**
   * Placeholder records so an editor sees a realistic layout before a
   * dataset is bound. Only the draft preview may use them; invented events
   * must never reach citizens.
   */
  readonly sample: (now: string) => readonly R[];
}
