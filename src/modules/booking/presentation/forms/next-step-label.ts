export interface NextStepLabelInput<Step extends string> {
  readonly next: Step | undefined;
  /** The step was opened from the review. */
  readonly returnsToReview: boolean;
  /** "Next: <step>". */
  readonly labelOf: (step: Step) => string;
  /** "Back to review". */
  readonly backToReview: string;
}

/**
 * What the wizard's primary button says: nothing on the last step (it saves instead), "back to the
 * review" when the step was opened from there, otherwise the next step's name.
 */
export function nextStepLabel<Step extends string>({
  next,
  returnsToReview,
  labelOf,
  backToReview,
}: NextStepLabelInput<Step>): string | undefined {
  if (next === undefined) {
    return undefined;
  }
  return returnsToReview ? backToReview : labelOf(next);
}
