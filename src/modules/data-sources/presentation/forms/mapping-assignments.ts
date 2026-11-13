import type { DatasetMappingInput } from '../../application/contracts/data-source-inputs';
import type { DatasetMappingView } from '../../application/contracts/dataset-views';

export function assignmentsFrom(mapping: DatasetMappingView | null): Record<string, string> {
  return Object.fromEntries(
    (mapping?.fields ?? []).map((field) => [field.sourcePath, field.targetPath]),
  );
}

export function sameAssignments(a: Record<string, string>, b: Record<string, string>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** A source can feed several targets. The simple editor changes its last assignment and keeps the others. */
export function mappingFieldsFrom(
  assignments: Record<string, string>,
  mapping: DatasetMappingView | null,
) {
  const fields = mapping?.fields ?? [];
  const lastIndex = new Map(fields.map((field, index) => [field.sourcePath, index]));
  const saved = fields.flatMap((field, index) => {
    if (lastIndex.get(field.sourcePath) !== index) {
      return [field];
    }
    const targetPath = assignments[field.sourcePath];
    if (targetPath === undefined) {
      return [];
    }
    return targetPath === field.targetPath
      ? [field]
      : [{ sourcePath: field.sourcePath, targetPath }];
  });
  const result: DatasetMappingInput['fields'] = [
    ...saved,
    ...Object.entries(assignments)
      .filter(([path]) => !lastIndex.has(path))
      .map(([sourcePath, targetPath]) => ({ sourcePath, targetPath })),
  ];
  return result.map(({ sourcePath, targetPath, transform }) => ({
    sourcePath,
    targetPath,
    ...(transform === undefined ? {} : { transform }),
  }));
}
