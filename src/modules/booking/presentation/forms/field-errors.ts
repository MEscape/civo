/**
 * The messages of react-hook-form's nested error object, by the dotted path of the field they belong
 * to (`openingHours.weekly.0.intervals.1.end`): the same paths the server names its field errors by,
 * so one editor can show an error wherever it came from. Values are error codes until translated.
 */
export function messagesByPath(errors: unknown, prefix = ''): Record<string, string> {
  if (typeof errors !== 'object' || errors === null) {
    return {};
  }
  const own: Record<string, string> =
    'message' in errors && typeof errors.message === 'string' && prefix !== ''
      ? { [prefix]: errors.message }
      : {};
  const nested = Object.entries(errors).flatMap(([key, child]) =>
    // `ref` is the DOM element the error belongs to, and `type` says which rule: neither is a field.
    key === 'ref' || key === 'type' || key === 'message'
      ? []
      : [messagesByPath(child, prefix === '' ? key : `${prefix}.${key}`)],
  );
  return nested.reduce<Record<string, string>>((all, next) => ({ ...all, ...next }), own);
}

/** The part of a location a field belongs to, by its path: where a failed save has to take a wizard. */
export function sectionOfPath(path: string): 'basics' | 'hours' | 'exceptions' {
  if (path.startsWith('openingHours.exceptions')) {
    return 'exceptions';
  }
  return path.startsWith('openingHours') ? 'hours' : 'basics';
}

/** The sections that hold any of these field paths, for taking a wizard to the first step with an error. */
export function sectionsOfPaths(paths: Iterable<string>): ReadonlySet<string> {
  return new Set(Array.from(paths, sectionOfPath));
}

/** The sections a refused save named fields in. */
export function sectionsOfFailure(error: {
  readonly fieldErrors?: Readonly<Record<string, unknown>>;
}): ReadonlySet<string> {
  return sectionsOfPaths(Object.keys(error.fieldErrors ?? {}));
}

/** The messages whose path starts with `prefix.` (a day, an exception), with that part of the path taken off. */
export function errorsUnder(
  errors: Readonly<Record<string, string>>,
  prefix: string | number,
): Record<string, string> {
  const start = `${prefix}.`;
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([path]) => path.startsWith(start))
      .map(([path, message]) => [path.slice(start.length), message]),
  );
}
