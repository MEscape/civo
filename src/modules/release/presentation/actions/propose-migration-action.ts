'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { releaseCommands } from '../../composition';
import { toMigrationProposalDto } from '../dto/migration-plan-dto';
import { parseReleaseInput } from '../schemas/parse-release-input';
import { proposeMigrationSchema } from '../schemas/propose-migration-schema';

import type { MigrationProposalDto } from '../dto/migration-plan-dto';

/**
 * Framework adapter: validate, call the use case. The use case itself
 * authenticates and authorizes, so there is no path around it.
 *
 * Proposing only reads pages and records the proposal, so there is nothing
 * to revalidate: no page an editor is looking at changes.
 */
export async function proposeMigrationAction(
  input: unknown,
): Promise<ActionResult<MigrationProposalDto>> {
  const result = await parseReleaseInput(proposeMigrationSchema, input).asyncAndThen((command) =>
    releaseCommands.proposeMigration.execute(command),
  );

  return toActionResult(result.map(toMigrationProposalDto));
}
