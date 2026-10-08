import { z } from 'zod';

import {
  BUILDER_VALIDATION_CODES as CODES,
  ID_MAX_LENGTH,
  PAGE_TREE_LIMITS,
} from '../../application/contracts/builder-constraints';

import type { PageNodeInput } from '../../application/contracts/page-views';

type ChildrenSchema = z.ZodType<readonly PageNodeInput[] | undefined>;

function createNodeSchema(children: ChildrenSchema): z.ZodType<PageNodeInput> {
  return z.object({
    id: z
      .string({ message: CODES.nodeIdInvalid })
      .min(1, { message: CODES.nodeIdInvalid })
      .max(ID_MAX_LENGTH, { message: CODES.nodeIdInvalid }),
    type: z
      .string({ message: CODES.nodeTypeInvalid })
      .min(1, { message: CODES.nodeTypeInvalid })
      .max(PAGE_TREE_LIMITS.typeMaxLength, { message: CODES.nodeTypeInvalid }),
    props: z.record(z.string(), z.unknown(), {
      message: CODES.nodePropsInvalid,
    }),
    children,
  });
}

/**
 * Built level by level instead of with `z.lazy`, so the depth limit bounds
 * the parser itself: a payload nested deeper than the domain allows fails
 * here without recursing through it. Deeper levels are rejected with the
 * depth code. Everything else (id alphabet, uniqueness, JSON-only props,
 * total size, nesting rules) stays with the domain.
 */
function buildNodeSchema(): z.ZodType<PageNodeInput> {
  let schema = createNodeSchema(z.array(z.never({ message: CODES.depthLimitExceeded })).optional());
  for (let level = 1; level < PAGE_TREE_LIMITS.maxDepth; level += 1) {
    schema = createNodeSchema(
      z
        .array(schema)
        .max(PAGE_TREE_LIMITS.maxNodes, { message: CODES.nodeLimitExceeded })
        .optional(),
    );
  }
  return schema;
}

const nodeSchema = buildNodeSchema();

export const pageConfigSchema = z.object({
  type: z.literal('page', { message: CODES.configInvalid }),
  children: z
    .array(nodeSchema, { message: CODES.configInvalid })
    .max(PAGE_TREE_LIMITS.maxNodes, { message: CODES.nodeLimitExceeded }),
});
