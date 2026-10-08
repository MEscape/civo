'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { builderCommands } from '../../composition';
import { toPageSummaryDto } from '../dto/page-dto';
import { builderRoutes } from '../routes';
import { newPageSchema } from '../schemas/new-page-schema';
import { parseBuilderInput } from '../schemas/parse-builder-input';

import type { PageSummaryDto } from '../dto/page-dto';

/** Framework adapter: validate, call the use case, invalidate. */
export async function createPageAction(input: unknown): Promise<ActionResult<PageSummaryDto>> {
  const result = await parseBuilderInput(newPageSchema, input).asyncAndThen((command) =>
    builderCommands.createPage.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(builderRoutes.pages(result.value.websiteId));
  }
  return toActionResult(result.map(toPageSummaryDto));
}
