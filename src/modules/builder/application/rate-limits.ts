import type { RateLimitPolicy } from '@lib/rate-limit';
import { SECONDS_PER_MINUTE } from '@lib/utils';

/**
 * Budgets for what an editor triggers while working on a page, per signed-in person.
 *
 * Both fail open when the store is down: an editor who cannot save or preview loses work, and the
 * actor is already authenticated and authorized, so a gap in the budget costs far less than
 * blocking the editor. The budgets only stop a runaway script or a tab stuck in a loop.
 */
export const BUILDER_RATE_LIMITS = {
  /**
   * A save is a database write of up to a whole page. Includes the release module's bulk apply of a
   * component update, which saves every affected page one after the other in a few seconds.
   */
  savePage: {
    id: 'builder.save-page',
    limit: 600,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'allow',
  },
  /** The canvas re-renders on every debounced edit, so a person dragging a component asks often. */
  renderDraft: {
    id: 'builder.render-draft',
    limit: 240,
    windowSeconds: SECONDS_PER_MINUTE,
    onBackendFailure: 'allow',
  },
} as const satisfies Record<string, RateLimitPolicy>;
