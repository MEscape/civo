'use server';

import { revalidatePath } from 'next/cache';

import { revalidateLocalizedPath } from '@i18n/server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getBuilderCommands } from '../../composition';
import { toPageSummaryDto } from '../dto/page-dto';
import { builderRoutes } from '../routes';
import { newPageSchema } from '../schemas/new-page-schema';
import { parseBuilderInput } from '../schemas/parse-builder-input';

import type { PageSummaryDto } from '../dto/page-dto';

/** Framework adapter: validate, call the use case, invalidate. */
export async function createPageAction(input: unknown): Promise<ActionResult<PageSummaryDto>> {
  const result = await parseBuilderInput(newPageSchema, input).asyncAndThen((command) =>
    getBuilderCommands().createPage.execute(command),
  );

  if (result.isOk()) {
    revalidateLocalizedPath(builderRoutes.pages(result.value.websiteId));
    revalidatePath(builderRoutes.websiteLayout, 'layout');
  }
  return toActionResult(result.map(toPageSummaryDto));
}
