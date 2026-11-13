import { useState } from 'react';

import { removeAt, replaceAt } from '@lib/utils';

import { parseCoverage } from '../../application/contracts/booking-constraints';
import { errorsUnder } from '../forms/field-errors';

import type { CoverageInputDto } from '../dto/team-dto';

/** A spell being made or changed: `index` is its place in the list, `null` while it is new. */
interface Draft {
  readonly index: number | null;
  readonly value: CoverageInputDto;
  /** Whether a save was tried: the messages wait for that, so a new dialog does not open in red. */
  readonly isChecked: boolean;
}

const BLANK: CoverageInputDto = { locationId: '', from: '', to: '' };

/**
 * What the cover list remembers about how it is edited: the spell open in the dialog and the one waiting
 * for a "remove?" answer. The spells themselves are the form's value and every change goes out through
 * `onChange`. A spell joins the list only once the rules the server applies (`parseCoverage`) accept it,
 * so the list never holds a half-filled row.
 */
export function useCoverageEditor(
  value: readonly CoverageInputDto[],
  onChange: (spells: CoverageInputDto[]) => void,
  rules: { readonly home: string; readonly locationIds: readonly string[] },
) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);

  /** The refusals of the rules for the draft, by path inside it (`locationId`, `from`, `to`). */
  const problemsOf = (current: Draft): Record<string, string> => {
    const index = current.index ?? value.length;
    const list =
      current.index === null ? [...value, current.value] : replaceAt(value, index, current.value);
    const result = parseCoverage(list, {
      home: rules.home,
      locationIds: new Set(rules.locationIds),
    });
    return result.isOk()
      ? {}
      : Object.fromEntries(
          Object.entries(errorsUnder(firstCodes(result.error.fieldErrors), index)),
        );
  };

  return {
    spell: draft?.value ?? null,
    isNew: draft?.index === null,
    problems: draft?.isChecked === true ? problemsOf(draft) : {},
    pendingRemoval,

    startAdd: () => {
      setDraft({ index: null, value: BLANK, isChecked: false });
    },
    startEdit: (index: number) => {
      const spell = value[index];
      if (spell !== undefined) {
        setDraft({ index, value: spell, isChecked: false });
      }
    },
    change: (spell: CoverageInputDto) => {
      setDraft((current) => (current === null ? null : { ...current, value: spell }));
    },
    save: () => {
      if (draft === null) {
        return;
      }
      if (Object.keys(problemsOf(draft)).length > 0) {
        setDraft({ ...draft, isChecked: true });
        return;
      }
      onChange(
        draft.index === null ? [...value, draft.value] : replaceAt(value, draft.index, draft.value),
      );
      setDraft(null);
    },
    cancel: () => {
      setDraft(null);
    },
    askToRemove: (index: number) => {
      setPendingRemoval(index);
    },
    cancelRemoval: () => {
      setPendingRemoval(null);
    },
    confirmRemoval: () => {
      if (pendingRemoval !== null) {
        onChange(removeAt(value, pendingRemoval));
      }
      setPendingRemoval(null);
    },
  };
}

/** The first code of each path, under the form's prefix (`coverage.2.from` → `2.from`). */
function firstCodes(fieldErrors: Readonly<Record<string, readonly string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).flatMap(([path, codes]) => {
      const code = codes[0];
      return code !== undefined && path.startsWith('coverage.')
        ? [[path.slice('coverage.'.length), code]]
        : [];
    }),
  );
}
