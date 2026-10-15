import { useEffect, useState } from 'react';

import { previewServiceFeasibilityAction } from '../actions/preview-service-feasibility-action';

import type { ServiceFeasibilityDto } from '../dto/setup-dto';

/** How long the form must be left alone before the server is asked; the check is not free. */
const CHECK_DELAY_MS = 700;

export interface FeasibilityQuery {
  readonly websiteId: string;
  readonly serviceId?: string | undefined;
  readonly locationIds: readonly string[];
  readonly requirements: ReadonlyArray<{
    readonly resourceType: string;
    readonly skills: readonly string[];
    readonly count: number;
    readonly resourceIds: readonly string[] | null;
  }>;
  readonly participantsPerBooking: number;
  readonly participantsPerSession: number;
}

export type FeasibilityState =
  /** Not enough is filled in to ask. */
  | { readonly status: 'incomplete' }
  | { readonly status: 'checking' }
  | { readonly status: 'ready'; readonly feasibility: ServiceFeasibilityDto }
  /** The server could not answer (infrastructure, not the configuration). */
  | { readonly status: 'unavailable' };

interface Answer {
  readonly key: string;
  readonly feasibility: ServiceFeasibilityDto | null;
}

/**
 * Asks the server whether the resources that exist can serve the service
 * being edited, once the form has been still for a moment. A slow answer to an
 * earlier version of the form is dropped, never shown, so the panel always
 * describes what is on screen. The rules live on the server; this only carries
 * the question.
 */
export function useServiceFeasibility(query: FeasibilityQuery): FeasibilityState {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const isComplete = query.locationIds.length > 0 && query.requirements.length > 0;
  const key = JSON.stringify(query);

  useEffect(() => {
    if (!isComplete) {
      return undefined;
    }
    let isCurrent = true;
    const timer = setTimeout(() => {
      void previewServiceFeasibilityAction(JSON.parse(key)).then((result) => {
        if (isCurrent) {
          setAnswer({ key, feasibility: result.ok ? result.data : null });
        }
      });
    }, CHECK_DELAY_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [isComplete, key]);

  if (!isComplete) {
    return { status: 'incomplete' };
  }
  if (answer?.key !== key) {
    return { status: 'checking' };
  }
  return answer.feasibility === null
    ? { status: 'unavailable' }
    : { status: 'ready', feasibility: answer.feasibility };
}
