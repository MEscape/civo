import type { ValidationAppError } from './app-error';

/**
 * Collects every field problem in one pass so the caller gets all of them
 * at once instead of fixing one field per round trip. Local to a single
 * validation call; never shared.
 *
 * `path` is a dotted field path (`colors.primary`), `code` a stable error
 * code. The owning module supplies the factory, so the error carries that
 * module's own `code` and `message`.
 */
export class FieldErrorBag {
  private readonly errors: Record<string, string[]> = {};

  constructor(
    private readonly fail: (fieldErrors: Record<string, string[]>) => ValidationAppError,
  ) {}

  add(path: string, code: string): void {
    const existing = this.errors[path];
    if (existing) {
      existing.push(code);
    } else {
      this.errors[path] = [code];
    }
  }

  get hasErrors(): boolean {
    return Object.keys(this.errors).length > 0;
  }

  toError(): ValidationAppError {
    // Copy the arrays too, so the returned error cannot alias the bag.
    return this.fail(
      Object.fromEntries(Object.entries(this.errors).map(([path, codes]) => [path, [...codes]])),
    );
  }
}
