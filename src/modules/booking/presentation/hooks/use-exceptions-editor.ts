import { useState } from 'react';

import { clamp, removeAt, replaceAt } from '@lib/utils';

import { exceptionProblems } from '../forms/exception-check';
import { BLANK_EXCEPTION, countsOf, rowsOf } from '../forms/exceptions';

import type { ExceptionInputDto } from '../dto/location-dto';
import type { ExceptionTab } from '../forms/exceptions';

export const EXCEPTIONS_PAGE_SIZE = 10;

/** The exception being made or changed in the dialog: `index` is its place in the list, `null` while it is new. */
interface Draft {
  readonly index: number | null;
  readonly value: ExceptionInputDto;
  /** Whether a save was tried: the messages wait for that, so a new dialog does not open in red. */
  readonly isChecked: boolean;
}

/**
 * What the exceptions list remembers about how it is shown and edited: the tab, the page, the
 * exception open in the dialog and the one waiting for a "remove?" answer. The exceptions themselves
 * are the form's value; every change goes out through `onChange` and nothing is kept here. An
 * exception is only added to the list once the rules accept it, so the list never holds a blank row
 * a person could forget about.
 */
export function useExceptionsEditor(
  value: readonly ExceptionInputDto[],
  onChange: (exceptions: ExceptionInputDto[]) => void,
) {
  const [tab, setTab] = useState<ExceptionTab>('all');
  const [requestedPage, setPage] = useState(1);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<number | null>(null);

  const rows = rowsOf(value, tab);
  const pageCount = Math.max(1, Math.ceil(rows.length / EXCEPTIONS_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const first = (page - 1) * EXCEPTIONS_PAGE_SIZE;

  /** The list as it would be if the draft were saved, and where the draft would sit in it. */
  const withDraft = (current: Draft) => {
    const index = current.index ?? value.length;
    return {
      index,
      list:
        current.index === null ? [...value, current.value] : replaceAt(value, index, current.value),
    };
  };
  const placed = draft === null ? null : withDraft(draft);
  const problems = placed === null ? {} : exceptionProblems(value, placed.list, placed.index);

  return {
    tab,
    counts: countsOf(value),
    rows,
    shown: rows.slice(first, first + EXCEPTIONS_PAGE_SIZE),
    isEmpty: value.length === 0,
    page,
    pageCount,
    firstShown: first + 1,
    pendingRemoval,
    draft: draft?.value ?? null,
    isDraftNew: draft?.index === null,
    /** The codes that stop the draft from being saved, by path inside it; empty until a save was tried. */
    draftProblems: draft?.isChecked === true ? problems : {},

    selectTab: (next: ExceptionTab) => {
      setTab(next);
      setPage(1);
    },
    goToPage: (next: number) => {
      setPage(clamp(next, 1, pageCount));
    },
    startAdd: () => {
      setDraft({ index: null, value: BLANK_EXCEPTION, isChecked: false });
    },
    startEdit: (index: number) => {
      const exception = value[index];
      if (exception !== undefined) {
        setDraft({ index, value: exception, isChecked: false });
      }
    },
    changeDraft: (next: ExceptionInputDto) => {
      setDraft(draft === null ? null : { ...draft, value: next });
    },
    cancelDraft: () => {
      setDraft(null);
    },
    saveDraft: () => {
      if (draft === null) {
        return;
      }
      if (Object.keys(problems).length > 0) {
        setDraft({ ...draft, isChecked: true });
        return;
      }
      const { index, list } = withDraft(draft);
      onChange(list);
      // Show where it landed: the list is in date order, so the new one may be on another page.
      const at = rowsOf(list, 'all').findIndex((row) => row.index === index);
      setTab('all');
      setPage(Math.floor(at / EXCEPTIONS_PAGE_SIZE) + 1);
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
