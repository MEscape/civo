import { z } from 'zod';

/** The editor's address: `?select=` names a component to open selected; repeats and junk are ignored. */
export const editorParamsSchema = z.object({
  select: z.string().optional().catch(undefined),
});
