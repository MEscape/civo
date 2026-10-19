'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { componentPlatformQueries } from '../../composition';
import { parseContentInput } from '../schemas/parse-content-input';
import { readTrendWindowSchema } from '../schemas/read-trend-window-schema';

import type { TrendWindowDto } from '../dto/trend-window-dto';

/**
 * The part of a published trend chart a visitor moved or zoomed to. Public
 * like the page itself: the use case counts the visitor's requests, scopes
 * the dataset to the website and only ever serves the published view, never
 * sample data.
 */
export async function readTrendWindowAction(input: unknown): Promise<ActionResult<TrendWindowDto>> {
  const result = await parseContentInput(readTrendWindowSchema, input).asyncAndThen((request) =>
    componentPlatformQueries.readTrendWindow.execute(request),
  );
  return toActionResult(result);
}
