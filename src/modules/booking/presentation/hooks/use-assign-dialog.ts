'use client';

import { useState, useTransition } from 'react';

import { assignEmployeeAction } from '../actions/assign-employee-action';
import { getAssignmentCandidatesAction } from '../actions/get-assignment-candidates-action';

import { useBookingCommand } from './use-booking-command';
import { useBookingWebsite } from './use-booking-website';

import type { AssignmentCandidatesDto } from '../dto/booking-dto';

/** Which unit of which booking is being given to someone, and whom it is taken from. */
export interface AssignTarget {
  readonly bookingId: string;
  readonly requirementIndex?: number | undefined;
  /** The employee being replaced; absent when an open unit is filled. */
  readonly replaces?: string | undefined;
}

export type CandidatesState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly view: AssignmentCandidatesDto }
  | { readonly kind: 'failed'; readonly code: string };

/** The fits the "recommended" tab shows: the preferences agree with the booking. */
const RECOMMENDED: ReadonlySet<string> = new Set(['very-good', 'good']);

export const recommendedOf = (view: AssignmentCandidatesDto) =>
  view.eligible.filter((candidate) => RECOMMENDED.has(candidate.fit.level));

/**
 * The assignment dialog: the candidates are asked for when it opens (and again after a lost race),
 * one is chosen, and the assignment is sent. The server decides who may serve; the dialog only shows
 * its answer, best fit first.
 */
export function useAssignDialog(target: AssignTarget) {
  const websiteId = useBookingWebsite();
  const [isOpen, setIsOpen] = useState(false);
  const [candidates, setCandidates] = useState<CandidatesState>({ kind: 'loading' });
  const [chosen, setChosen] = useState<string | null>(null);
  const [, startLoading] = useTransition();
  const command = useBookingCommand();

  function load() {
    setCandidates({ kind: 'loading' });
    setChosen(null);
    startLoading(async () => {
      const result = await getAssignmentCandidatesAction({
        websiteId,
        bookingId: target.bookingId,
        requirementIndex: target.requirementIndex,
      });
      setCandidates(
        result.ok
          ? { kind: 'ready', view: result.data }
          : { kind: 'failed', code: result.error.code },
      );
    });
  }

  function assign() {
    if (chosen === null || candidates.kind !== 'ready') {
      return;
    }
    command.run(
      () =>
        assignEmployeeAction({
          websiteId,
          bookingId: target.bookingId,
          resourceId: chosen,
          requirementIndex: candidates.view.requirementIndex,
          replaces: target.replaces,
        }),
      {
        onDone: () => {
          setIsOpen(false);
        },
        onRace: load,
      },
    );
  }

  return {
    isOpen,
    candidates,
    chosen,
    choose: setChosen,
    command,
    open: () => {
      command.clear();
      setIsOpen(true);
      load();
    },
    close: () => {
      setIsOpen(false);
    },
    assign,
  };
}
