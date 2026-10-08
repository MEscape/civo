import { z } from 'zod';

import {
  MAPPING_LIMITS,
  SIMPLE_TRANSFORM_KINDS,
  DATA_SOURCE_VALIDATION_CODES as CODES,
} from '../../application/contracts/data-source-constraints';

const simpleTransformSchema = z.object({
  kind: z.enum(SIMPLE_TRANSFORM_KINDS),
});

const joinTransformSchema = z.object({
  kind: z.literal('join'),
  sourcePaths: z
    .array(z.string().min(1).max(MAPPING_LIMITS.maxPathLength))
    .min(1)
    .max(MAPPING_LIMITS.maxJoinSources),
  separator: z.string().max(MAPPING_LIMITS.maxSeparatorLength).optional(),
});

const fallbackTransformSchema = z.object({
  kind: z.literal('fallback'),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const transformSchema = z.discriminatedUnion('kind', [
  simpleTransformSchema,
  joinTransformSchema,
  fallbackTransformSchema,
]);

const fieldMappingSchema = z.object({
  sourcePath: z
    .string()
    .min(1, { message: CODES.sourcePathInvalid })
    .max(MAPPING_LIMITS.maxPathLength, { message: CODES.sourcePathInvalid }),
  targetPath: z
    .string()
    .min(1, { message: CODES.targetPathInvalid })
    .max(MAPPING_LIMITS.maxPathLength, { message: CODES.targetPathInvalid }),
  transform: transformSchema.optional(),
});

export const datasetMappingShapeSchema = z.object({
  fields: z
    .array(fieldMappingSchema)
    .min(1, { message: CODES.mappingFieldCountInvalid })
    .max(MAPPING_LIMITS.maxFields, { message: CODES.mappingFieldCountInvalid }),
});
