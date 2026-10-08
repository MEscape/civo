'use server';

import type { ReactNode } from 'react';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { builderQueries } from '../../composition';
import { parseBuilderInput } from '../schemas/parse-builder-input';
import { renderDraftPageSchema } from '../schemas/render-draft-page-schema';

/**
 * Renders an unsaved draft for the canvas. The element tree travels
 * through the RSC payload, so the client never builds HTML strings. The
 * website whose data components preview against is read from the STORED
 * page by the use case, never from this input.
 */
export async function renderDraftPageAction(input: unknown): Promise<ActionResult<ReactNode>> {
  const result = await parseBuilderInput(renderDraftPageSchema, input).asyncAndThen((query) =>
    builderQueries.renderDraftPage.execute(query),
  );

  return toActionResult(result);
}
