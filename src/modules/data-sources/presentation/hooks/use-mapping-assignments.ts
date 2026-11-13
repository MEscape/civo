'use client';

import { useState } from 'react';

import { omit } from '@lib/utils';

import { assignmentsFrom, mappingFieldsFrom, sameAssignments } from '../forms/mapping-assignments';

import type { DatasetMappingView } from '../../application/contracts/dataset-views';

/** Owns the saved baseline separately from edits, so a successful save is immediately clean. */
export function useMappingAssignments(existingMapping: DatasetMappingView | null) {
  const [baseline, setBaseline] = useState({ upstream: existingMapping, mapping: existingMapping });
  const [assignments, setAssignments] = useState(() => assignmentsFrom(existingMapping));
  const isDirty = !sameAssignments(assignments, assignmentsFrom(baseline.mapping));
  if (baseline.upstream !== existingMapping) {
    if (!isDirty) {
      setAssignments(assignmentsFrom(existingMapping));
    }
    setBaseline({ upstream: existingMapping, mapping: existingMapping });
  }
  return {
    assignments,
    isDirty,
    baseline: baseline.mapping,
    buildFields: () => mappingFieldsFrom(assignments, baseline.mapping),
    markSaved: (mapping: DatasetMappingView | null) => {
      setAssignments(assignmentsFrom(mapping));
      setBaseline({ upstream: existingMapping, mapping });
    },
    /** Adds a whole set of assignments at once, as a suggestion does; later ones replace earlier ones. */
    assignMany: (added: Readonly<Record<string, string>>) => {
      setAssignments((previous) => ({ ...previous, ...added }));
    },
    assign: (sourcePath: string, targetPath: string) => {
      setAssignments((previous) => {
        const rest = omit(previous, [sourcePath]);
        return targetPath === '' ? rest : { ...rest, [sourcePath]: targetPath };
      });
    },
  };
}
