'use server';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getMediaCommands } from '../../composition';
import { toRequestedUploadDto } from '../dto/media-dto';
import { parseMediaInput } from '../schemas/parse-media-input';
import { requestUploadSchema } from '../schemas/request-upload-schema';

import type { RequestedUploadDto } from '../dto/media-dto';

/**
 * Asks to upload one file into the named website. The use case checks that the signed-in person
 * may upload there, whichever website the session has open.
 */
export async function requestMediaUploadAction(
  input: unknown,
): Promise<ActionResult<RequestedUploadDto>> {
  const result = await parseMediaInput(requestUploadSchema, input).asyncAndThen((command) =>
    getMediaCommands().requestUpload.execute(command),
  );
  return toActionResult(result.map(toRequestedUploadDto));
}
