/**
 * The trimmed text, or `null` when nothing is left. (`@lib/utils`'s
 * `trimToNull` only maps absent values to `null`: a blank string stays `''`,
 * which would pass a "required" check.)
 */
export function blankToNull(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
