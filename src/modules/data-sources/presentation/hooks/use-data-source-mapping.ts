'use client';

import { useEffect, useEffectEvent, useState, useTransition } from 'react';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

import { useTranslations } from '@i18n/client';

import type { SerializedActionError } from '@lib/result';
import { unique } from '@lib/utils';

import {
  CANONICAL_TARGET_FIELDS,
  DATA_SOURCE_VALIDATION_CODES,
} from '../../application/contracts/data-source-constraints';
import { discoverDatasetAction } from '../actions/discover-dataset-action';
import { previewDatasetMappingAction } from '../actions/preview-dataset-mapping-action';
import { saveDatasetMappingAction } from '../actions/save-dataset-mapping-action';
import { assignmentsFrom as assignmentsFromBaseline } from '../forms/mapping-assignments';
import { suggestAssignments } from '../forms/suggest-assignments';
import { targetFieldMessageKey } from '../messages/message-keys';

import { useMappingAssignments } from './use-mapping-assignments';

import type {
  CanonicalKind,
  DatasetMappingView,
  DiscoveredFieldView,
} from '../../application/contracts/dataset-views';

/**
 * The outcome of the most recent user action: one union instead of three
 * flags that were mutually exclusive in practice anyway.
 */
type PanelStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'failed'; readonly error: SerializedActionError }
  | { readonly kind: 'previewed'; readonly json: string }
  | { readonly kind: 'saved' };

const FIELD_ROW_KEY = /^fields\.(\d+)\./;

/** Used when the user asks for a preview or save with nothing assigned: the server rule, said early. */
const NOTHING_ASSIGNED: SerializedActionError = {
  code: DATA_SOURCE_VALIDATION_CODES.mappingFieldCountInvalid,
  message: '',
};

/** Used when the person moves on while a required field has nothing assigned. */
const REQUIRED_MISSING: SerializedActionError = {
  code: DATA_SOURCE_VALIDATION_CODES.requiredTargetMissing,
  message: '',
};

interface DataSourceMappingOptions {
  readonly datasetId: string;
  readonly canonicalKind: CanonicalKind;
  readonly existingMapping: DatasetMappingView | null;
  /** Reads the fields from the source as soon as the screen opens, instead of waiting for a click. */
  readonly autoLoad?: boolean;
  /** Told once the mapping is saved, so the screen can move on. */
  readonly onSaved?: (() => void) | undefined;
}

/** The state of the mapping panel: discovered fields, the assignments being edited, and the last outcome. */
export function useDataSourceMapping({
  datasetId,
  canonicalKind,
  existingMapping,
  autoLoad = false,
  onSaved,
}: DataSourceMappingOptions) {
  const t = useTranslations('dataSources');
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<readonly DiscoveredFieldView[] | null>(null);
  const mapping = useMappingAssignments(existingMapping);
  const { assignments, isDirty } = mapping;
  const [status, setStatus] = useState<PanelStatus>({ kind: 'idle' });
  const [suggestedCount, setSuggestedCount] = useState(0);
  const targets = CANONICAL_TARGET_FIELDS[canonicalKind];
  const missingRequired = targets.filter(
    (target) => target.required && !Object.values(assignments).includes(target.path),
  );

  useReportUnsavedChanges(isDirty);

  function targetLabel(path: string): string {
    const key = targetFieldMessageKey(canonicalKind, path) as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : path;
  }

  /** Server keys are target paths, or `fields.<n>.<prop>` for structural problems. */
  function describeKey(key: string): string {
    const row = FIELD_ROW_KEY.exec(key);
    return row?.[1] === undefined
      ? targetLabel(key)
      : t('mapping.fieldRow', { row: Number(row[1]) + 1 });
  }

  function targetsUsedElsewhere(sourcePath: string): Set<string> {
    const mappingFields = mapping.buildFields();
    const ownTarget = assignments[sourcePath];
    return new Set(
      mappingFields
        .filter((field) => field.sourcePath !== sourcePath || field.targetPath !== ownTarget)
        .map((field) => field.targetPath),
    );
  }

  async function discover() {
    const result = await discoverDatasetAction(datasetId);
    if (!result.ok) {
      setStatus({ kind: 'failed', error: result.error });
      return;
    }
    // A first mapping starts from the names that match, so the person checks it instead of building it.
    if (mapping.baseline === null && Object.keys(assignments).length === 0) {
      const suggestions = suggestAssignments(result.data.fields, targets);
      mapping.assignMany(suggestions);
      setSuggestedCount(Object.keys(suggestions).length);
    }
    const paths = new Set(result.data.fields.map((field) => field.path));
    const savedPaths = unique([
      ...(mapping.baseline?.fields ?? []).map((field) => field.sourcePath),
      ...Object.keys(assignments),
    ]);
    setFields([
      ...result.data.fields,
      ...savedPaths
        .filter((path) => !paths.has(path))
        .map((path) => ({
          path,
          sampleType: 'null' as const,
          sampleValue: t('mapping.notSampled'),
        })),
    ]);
  }

  function handleDiscover() {
    setStatus({ kind: 'idle' });
    startTransition(discover);
  }

  function handleAssign(sourcePath: string, targetPath: string) {
    mapping.assign(sourcePath, targetPath);
    setStatus({ kind: 'idle' });
  }

  const discoverOnOpen = useEffectEvent(discover);
  useEffect(() => {
    if (autoLoad) {
      startTransition(discoverOnOpen);
    }
  }, [autoLoad]);

  /** Whether the assignments can go on to review: something is assigned and every required target is covered. */
  function checkComplete(): boolean {
    if (Object.keys(assignments).length === 0) {
      setStatus({ kind: 'failed', error: NOTHING_ASSIGNED });
      return false;
    }
    if (missingRequired.length > 0) {
      setStatus({ kind: 'failed', error: REQUIRED_MISSING });
      return false;
    }
    setStatus({ kind: 'idle' });
    return true;
  }

  function handlePreview() {
    const mappingFields = mapping.buildFields();
    if (mappingFields.length === 0) {
      setStatus({ kind: 'failed', error: NOTHING_ASSIGNED });
      return;
    }
    startTransition(async () => {
      const result = await previewDatasetMappingAction({
        datasetId,
        mapping: { fields: mappingFields },
      });
      setStatus(
        result.ok
          ? { kind: 'previewed', json: result.data.json }
          : { kind: 'failed', error: result.error },
      );
    });
  }

  function handleSave() {
    const mappingFields = mapping.buildFields();
    if (mappingFields.length === 0) {
      setStatus({ kind: 'failed', error: NOTHING_ASSIGNED });
      return;
    }
    startTransition(async () => {
      const result = await saveDatasetMappingAction({
        datasetId,
        mapping: { fields: mappingFields },
      });
      if (!result.ok) {
        setStatus({ kind: 'failed', error: result.error });
        return;
      }
      mapping.markSaved(result.data.mapping);
      setSuggestedCount(0);
      setStatus({ kind: 'saved' });
      onSaved?.();
    });
  }

  const failure = status.kind === 'failed' ? status.error : null;

  return {
    isPending,
    preservedAssignments:
      (mapping.baseline?.fields.length ?? 0) -
      Object.keys(assignmentsFromBaseline(mapping.baseline)).length,
    fields,
    assignments,
    status,
    failure,
    failureDetails: Object.entries(failure?.fieldErrors ?? {}),
    targets,
    isDirty,
    suggestedCount,
    /** The targets a component cannot do without that nothing is assigned to yet. */
    missingRequired,
    targetLabel,
    describeKey,
    targetsUsedElsewhere,
    handleDiscover,
    handleAssign,
    checkComplete,
    handlePreview,
    handleSave,
  };
}
