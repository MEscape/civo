export interface ComboboxOption {
  readonly value: string;
  readonly label: string;
}

export interface CreateCandidateRequest {
  readonly query: string;
  readonly options: readonly ComboboxOption[];
  readonly selectedValues: readonly string[];
  readonly normalize: (raw: string) => string | null;
}

/** The value the user can create from what they typed; `null` when it would duplicate one or is empty. */
export function createCandidate({
  query,
  options,
  selectedValues,
  normalize,
}: CreateCandidateRequest): string | null {
  const candidate = normalize(query);
  if (candidate === null || candidate === '') {
    return null;
  }
  const exists =
    selectedValues.includes(candidate) || options.some((option) => option.value === candidate);
  return exists ? null : candidate;
}

export interface FilterRequest {
  readonly options: readonly ComboboxOption[];
  readonly query: string;
  readonly selectedValues: readonly string[];
  /** Leave chosen values out of the list (a chip list already shows them). */
  readonly hideSelected: boolean;
  /** `false` when the options already match the query (they came from a search): none are dropped for text. */
  readonly matchLocally: boolean;
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * The options that match what was typed, in their given order. Matching is
 * case-insensitive and ignores accents, so "buro" finds "Büro".
 */
export function filterComboboxOptions({
  options,
  query,
  selectedValues,
  hideSelected,
  matchLocally,
}: FilterRequest): readonly ComboboxOption[] {
  const needle = matchLocally ? fold(query.trim()) : '';
  return options.filter(
    (option) =>
      (!hideSelected || !selectedValues.includes(option.value)) &&
      (needle === '' || fold(option.label).includes(needle) || fold(option.value).includes(needle)),
  );
}

/** What a key press means for the list, decided apart from the DOM so it can be tested alone. */
export type KeyIntent =
  | { readonly kind: 'move'; readonly step: 1 | -1 }
  | { readonly kind: 'pick' }
  | { readonly kind: 'create' }
  | { readonly kind: 'close' }
  | { readonly kind: 'remove-last' }
  | { readonly kind: 'ignore' };

export interface KeyContext {
  readonly isOpen: boolean;
  readonly query: string;
  readonly canCreate: boolean;
  readonly hasChips: boolean;
}

export function intentForKey(key: string, context: KeyContext): KeyIntent {
  switch (key) {
    case 'ArrowDown':
      return { kind: 'move', step: 1 };
    case 'ArrowUp':
      return { kind: 'move', step: -1 };
    // Enter inside a form must pick, never submit; once the list is closed it is left to the form.
    case 'Enter':
      return context.isOpen ? { kind: 'pick' } : { kind: 'ignore' };
    case ',':
      return context.canCreate ? { kind: 'create' } : { kind: 'ignore' };
    case 'Escape':
      return context.isOpen ? { kind: 'close' } : { kind: 'ignore' };
    case 'Backspace':
      return context.query === '' && context.hasChips
        ? { kind: 'remove-last' }
        : { kind: 'ignore' };
    default:
      return { kind: 'ignore' };
  }
}

export interface ComboboxRow {
  readonly value: string;
  readonly label: string;
  /** The "add what I typed" row rather than an existing option. */
  readonly isCreate: boolean;
}

export interface RowsRequest extends FilterRequest {
  readonly normalize: (raw: string) => string | null;
  /** Labels the create row; `undefined` when creating is not allowed. */
  readonly createText: ((value: string) => string) | undefined;
}

export interface Rows {
  readonly rows: readonly ComboboxRow[];
  /** The value the create row would add, or `null` when there is none. */
  readonly created: string | null;
}

/** The options that match, followed by a create row when the typed text is new and creating is allowed. */
export function buildRows(request: RowsRequest): Rows {
  const rows: ComboboxRow[] = filterComboboxOptions(request).map((option) => ({
    value: option.value,
    label: option.label,
    isCreate: false,
  }));
  const created =
    request.createText === undefined
      ? null
      : createCandidate({
          query: request.query,
          options: request.options,
          selectedValues: request.selectedValues,
          normalize: request.normalize,
        });
  if (created !== null && request.createText !== undefined) {
    rows.push({ value: created, label: request.createText(created), isCreate: true });
  }
  return { rows, created };
}
