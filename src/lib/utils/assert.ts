/**
 * Exhaustiveness and invariant helpers. Zero dependencies.
 * Both throw: they signal programmer errors, never expected failures
 * (errors.md).
 */

/**
 * Marks a code path as unreachable. Placing it in the `default` branch of a
 * `switch` over a union turns a forgotten variant into a compile-time error
 * (typescript.md: exhaustive checks).
 */
export function assertNever(value: never, message?: string): never {
  throw new Error(message ?? `Unexpected value: ${JSON.stringify(value)}`);
}

/**
 * Asserts a condition that must hold if the program is correct. Throws on
 * failure, so never use it to validate external input; use a schema for
 * that (validation.md).
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Invariant violation: ${message}`);
  }
}
