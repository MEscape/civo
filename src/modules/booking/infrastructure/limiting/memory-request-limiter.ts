import type { LimitedAction, RequestLimiter } from '../../domain/ports/request-limiter.port';

export interface RequestBudget {
  /** Requests allowed per window. */
  readonly max: number;
  readonly windowMs: number;
}

const ONE_MINUTE_MS = 60_000;

/** Generous for reading availability, strict for the actions that reserve or reveal something. */
export const DEFAULT_BUDGETS: Readonly<Record<LimitedAction, RequestBudget>> = {
  search: { max: 120, windowMs: ONE_MINUTE_MS },
  hold: { max: 12, windowMs: ONE_MINUTE_MS },
  confirm: { max: 12, windowMs: ONE_MINUTE_MS },
  lookup: { max: 10, windowMs: ONE_MINUTE_MS },
  change: { max: 10, windowMs: ONE_MINUTE_MS },
};

/** A bound on memory: when exceeded, the oldest visitors are forgotten first. */
const MAX_TRACKED_KEYS = 20_000;

/**
 * A sliding-window limiter held in this server process. It is not shared
 * between instances, so each instance enforces its own budget: enough to stop
 * a script hammering one instance, not a global guarantee. The database
 * constraints and the caps on live holds and bookings are what protect the
 * data; this only keeps one visitor from using up the server.
 */
export class MemoryRequestLimiter implements RequestLimiter {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly budgets: Readonly<Record<LimitedAction, RequestBudget>> = DEFAULT_BUDGETS,
  ) {}

  allow(key: string, action: LimitedAction, now: Date): boolean {
    const budget = this.budgets[action];
    const slot = `${action}:${key}`;
    const cutoff = now.getTime() - budget.windowMs;
    const recent = (this.attempts.get(slot) ?? []).filter((at) => at > cutoff);

    if (recent.length >= budget.max) {
      this.attempts.set(slot, recent);
      return false;
    }
    recent.push(now.getTime());
    // Re-inserting moves the key to the end of the iteration order, so the oldest are dropped first.
    this.attempts.delete(slot);
    this.attempts.set(slot, recent);
    this.trim();
    return true;
  }

  private trim(): void {
    while (this.attempts.size > MAX_TRACKED_KEYS) {
      const oldest = this.attempts.keys().next();
      if (oldest.done === true) {
        return;
      }
      this.attempts.delete(oldest.value);
    }
  }
}
