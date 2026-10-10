/** The public actions a visitor can repeat; each has its own budget. */
export const LIMITED_ACTIONS = ['search', 'hold', 'confirm', 'lookup', 'change'] as const;
export type LimitedAction = (typeof LIMITED_ACTIONS)[number];

/**
 * Decides whether one visitor may make another request. The key identifies
 * the visitor and the website (never a person's name or e-mail address).
 * Synchronous on purpose: the decision must not add a network round trip to
 * a request that is about to do real work.
 */
export interface RequestLimiter {
  /** Records the attempt and answers whether it is within the budget. */
  allow(key: string, action: LimitedAction, now: Date): boolean;
}
