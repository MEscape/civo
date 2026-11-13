import { MS_PER_MINUTE } from '@lib/utils';

import { occupancyOf } from '../../domain/scheduling/occupancy';
import { createSlotRules } from '../../domain/scheduling/slot-rules';
import { asInstant } from '../../domain/time/instant';
import { parseMinutes } from '../../domain/time/minutes';

import { SERVICE_LIMITS } from './booking-constraints';

/** What the form knows about a service when it draws the preview. */
export interface OccupancyPreviewInput {
  readonly durationMinutes: number;
  readonly preparationMinutes: number;
  readonly cleanupMinutes: number;
  /** The service asks for an employee: someone is held for the preparation and clean-up. */
  readonly needsEmployee: boolean;
  /** The required resources, each with its own setup and teardown. */
  readonly resources: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly setupMinutes: number;
    readonly teardownMinutes: number;
  }>;
}

/** A span in minutes from the start of the appointment: negative before it. */
export interface PreviewSpan {
  readonly fromMinute: number;
  readonly toMinute: number;
}

export interface OccupancyPreview {
  /** What the citizen sees. */
  readonly citizen: PreviewSpan;
  /** What the employee is held for; `null` when the service asks for none. */
  readonly employee: PreviewSpan | null;
  readonly resources: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly span: PreviewSpan;
  }>;
}

/** An arbitrary, far-from-the-edges start: only the distances from it are used. */
const EXAMPLE_YEAR = 2100;
const EXAMPLE_START_MS = Date.UTC(EXAMPLE_YEAR, 0, 1);

/**
 * Who is occupied when, for a form that is still being filled in. It asks the domain's
 * `occupancyOf`, the very function the scheduling engine holds resources by, with an appointment at
 * an arbitrary start: the answer is the same spans measured from that start, so the preview shows
 * what the engine will do and cannot drift from it. `null` while the numbers are not ones the engine
 * accepts (a duration of no minutes), when there is nothing to show.
 */
export function previewOccupancy(input: OccupancyPreviewInput): OccupancyPreview | null {
  const rules = createSlotRules({
    durationMinutes: input.durationMinutes,
    preparationMinutes: input.preparationMinutes,
    cleanupMinutes: input.cleanupMinutes,
    stepMinutes: SERVICE_LIMITS.defaultStepMinutes,
  });
  const resources = input.resources.map((resource) => ({
    ...resource,
    setup: parseMinutes(resource.setupMinutes),
    teardown: parseMinutes(resource.teardownMinutes),
  }));
  if (
    rules.isErr() ||
    resources.some(({ setup, teardown }) => setup === null || teardown === null)
  ) {
    return null;
  }
  // Far enough from the ends of the supported years for any buffer.
  const start = asInstant(EXAMPLE_START_MS);
  const occupancy = occupancyOf(
    start,
    rules.value,
    resources.flatMap(({ id, setup, teardown }) =>
      setup === null || teardown === null
        ? []
        : [{ id, isEmployee: false, setupMinutes: setup, teardownMinutes: teardown }],
    ),
  );
  const spanOf = ({ start: from, end }: { start: number; end: number }): PreviewSpan => ({
    fromMinute: (from - start) / MS_PER_MINUTE,
    toMinute: (end - start) / MS_PER_MINUTE,
  });
  const names = new Map(input.resources.map((resource) => [resource.id, resource.name]));
  return {
    citizen: spanOf(occupancy.citizen),
    employee: input.needsEmployee ? spanOf(occupancy.employee) : null,
    resources: occupancy.resources.map(({ id, span }) => ({
      id,
      name: names.get(id) ?? id,
      span: spanOf(span),
    })),
  };
}
