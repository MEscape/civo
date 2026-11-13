'use server';

import { revalidatePath } from 'next/cache';

import { toActionResult } from '@lib/result';
import type { ActionResult } from '@lib/result';

import { getProfileCommands } from '../../composition';
import { ROOT_LAYOUT_PATH } from '../routes';
import { parseAuthInput } from '../schemas/parse-auth-input';
import { profileFormDataSchema, profileSchema } from '../schemas/profile-schema';

/** Only name, file bytes, and the explicit removal flag cross into the use case. */
export async function updateOwnProfileAction(input: unknown): Promise<ActionResult<void>> {
  const parsed = parseAuthInput(profileFormDataSchema, input).andThen((data) => {
    const file = data.get('image');
    return parseAuthInput(profileSchema, {
      name: data.get('name'),
      removeImage: data.get('removeImage') === 'true',
      image: file ?? undefined,
    });
  });
  if (parsed.isErr()) {
    return toActionResult(parsed.map(() => undefined));
  }
  const { name, image, removeImage } = parsed.value;
  const photo =
    image === undefined
      ? undefined
      : {
          contentType: image.type,
          bytes: new Uint8Array(await image.arrayBuffer()),
        };
  const selectedImage = removeImage ? null : photo;
  const result = await getProfileCommands().updateOwnProfile.execute({
    name,
    ...(selectedImage === undefined ? {} : { image: selectedImage }),
  });
  if (result.isOk()) {
    revalidatePath(ROOT_LAYOUT_PATH, 'layout');
  }
  return toActionResult(result);
}
