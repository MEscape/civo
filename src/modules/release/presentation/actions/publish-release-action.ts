'use server';

import { revalidatePath } from 'next/cache';

import { builderRoutes } from '@modules/builder/client';
import { websiteRoutes } from '@modules/website/client';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { releaseCommands } from '../../composition';
import { toReleaseSummaryDto } from '../dto/release-dto';
import { parseReleaseInput } from '../schemas/parse-release-input';
import { publishReleaseSchema } from '../schemas/publish-release-schema';

import type { ReleaseSummaryDto } from '../dto/release-dto';

/**
 * Framework adapter: validate, call the use case, invalidate. The use case
 * itself authenticates and authorizes, so there is no path around it.
 *
 * Publishing is deliberately separate from saving a page: saving only ever
 * writes a draft, this is the one action that makes pages public.
 */
export async function publishReleaseAction(
  input: unknown,
): Promise<ActionResult<ReleaseSummaryDto>> {
  const result = await parseReleaseInput(publishReleaseSchema, input).asyncAndThen((command) =>
    releaseCommands.publishRelease.execute(command),
  );

  if (result.isOk()) {
    revalidatePath(websiteRoutes.detail(result.value.websiteId));
    revalidatePath(builderRoutes.pages(result.value.websiteId));
  }
  return toActionResult(result.map(toReleaseSummaryDto));
}
