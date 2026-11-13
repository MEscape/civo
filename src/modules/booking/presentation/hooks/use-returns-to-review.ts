'use client';

import { useSearchParams } from 'next/navigation';

/** The address parameter a step carries when it was opened from the review: finishing it goes straight back. */
export const RETURN_PARAM = 'back';
const REVIEW = 'review';

/** The address of a step, opened from the review. */
export function withReviewReturn(href: string): string {
  return `${href}${href.includes('?') ? '&' : '?'}${RETURN_PARAM}=${REVIEW}`;
}

/**
 * Whether the step on screen was opened from the review ("Edit" on a row): the wizard then offers one way
 * on, back to the review, instead of walking through the steps in between again.
 */
export function useReturnsToReview(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- typed as always there, but it is `null` outside the app router (a test, a preview).
  return useSearchParams()?.get(RETURN_PARAM) === REVIEW;
}
