import type { ContentOf } from '../../../../application/contracts/component-platform-constraints';

type Goal = ContentOf<'SmartCityGoal'>;

/** A goal that can be drawn as progress: it has a target other than zero. */
interface GaugeGoal {
  readonly metric: Goal;
  readonly target: number;
}

/** The goal with the given id, else the first one; `null` when there is none or it has no usable target. */
export function pickGoal(items: readonly Goal[], goalId: string | null): GaugeGoal | null {
  const metric = goalId === null ? items[0] : items.find((item) => item.id === goalId);
  const target = metric?.target;
  return metric === undefined || target === undefined || target === 0 ? null : { metric, target };
}
