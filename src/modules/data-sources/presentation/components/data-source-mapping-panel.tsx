'use client';

import { useId, useState, useTransition } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import type { SerializedActionError } from '@lib/result';
import { omit } from '@lib/utils';

import {
  CANONICAL_TARGET_FIELDS,
  DATA_SOURCE_VALIDATION_CODES,
} from '../../application/contracts/data-source-constraints';
import { discoverDatasetAction } from '../actions/discover-dataset-action';
import { previewDatasetMappingAction } from '../actions/preview-dataset-mapping-action';
import { saveDatasetMappingAction } from '../actions/save-dataset-mapping-action';
import { MESSAGE_PARAMS, messageKeyForCode, targetFieldMessageKey } from '../messages/message-keys';

import { DataSourceMappingTable } from './data-source-mapping-table';

import type {
  CanonicalKind,
  DatasetMappingView,
  DiscoveredFieldView,
} from '../../application/contracts/data-source-views';

export interface DataSourceMappingPanelProps {
  readonly datasetId: string;
  readonly canonicalKind: CanonicalKind;
  /** The mapping already saved, so reopening the panel does not discard it. */
  readonly existingMapping: DatasetMappingView | null;
}

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

function assignmentsFrom(mapping: DatasetMappingView | null): Record<string, string> {
  return Object.fromEntries((mapping?.fields ?? []).map((f) => [f.sourcePath, f.targetPath]));
}

/**
 * Discovery plus mapping, in two steps: "load fields" samples the live
 * source, then each discovered field is assigned a canonical target field.
 *
 * This UI authors direct field-to-field assignments only. A transform
 * already saved for an assignment is KEPT when the same assignment is saved
 * again (previously reopening and saving silently dropped it); authoring new
 * transforms is a later, additive step the model already supports.
 */
export function DataSourceMappingPanel({
  datasetId,
  canonicalKind,
  existingMapping,
}: DataSourceMappingPanelProps) {
  const t = useTranslations('dataSources');

  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<readonly DiscoveredFieldView[] | null>(null);
  const [assignments, setAssignments] = useState(() => assignmentsFrom(existingMapping));
  const [status, setStatus] = useState<PanelStatus>({ kind: 'idle' });

  const targets = CANONICAL_TARGET_FIELDS[canonicalKind];

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
    return new Set(
      Object.entries(assignments)
        .filter(([path]) => path !== sourcePath)
        .map(([, target]) => target),
    );
  }

  function buildFields() {
    return Object.entries(assignments).map(([sourcePath, targetPath]) => {
      const kept = existingMapping?.fields.find(
        (field) => field.sourcePath === sourcePath && field.targetPath === targetPath,
      )?.transform;
      return { sourcePath, targetPath, ...(kept ? { transform: kept } : {}) };
    });
  }

  function handleDiscover() {
    setStatus({ kind: 'idle' });
    startTransition(async () => {
      const result = await discoverDatasetAction(datasetId);
      if (!result.ok) {
        setStatus({ kind: 'failed', error: result.error });
        return;
      }
      setFields(result.data.fields);
    });
  }

  function handleAssign(sourcePath: string, targetPath: string) {
    setAssignments((previous) => {
      const rest = omit(previous, [sourcePath]);
      return targetPath === '' ? rest : { ...rest, [sourcePath]: targetPath };
    });
    setStatus({ kind: 'idle' });
  }

  function handlePreview() {
    const mappingFields = buildFields();
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
    const mappingFields = buildFields();
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
      setStatus({ kind: 'saved' });
      router.refresh();
    });
  }

  const failure = status.kind === 'failed' ? status.error : null;
  const failureDetails = Object.entries(failure?.fieldErrors ?? {});

  return (
    <div className="space-y-3 border-t border-border pt-4" aria-busy={isPending}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-copy">{t('mapping.title')}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDiscover}
          disabled={isPending}
        >
          {isPending ? t('mapping.loading') : t('mapping.load')}
        </Button>
      </div>

      {failure !== null && (
        <div role="alert" className="space-y-1 text-sm text-danger">
          <FieldMessage
            id={`${id}-error`}
            message={failure.code ? t(messageKeyForCode(failure.code), MESSAGE_PARAMS) : undefined}
            className="text-sm"
          />
          {failureDetails.length > 0 && (
            <ul className="list-disc pl-5 text-xs">
              {failureDetails.map(([key, codes]) => (
                <li key={key}>
                  {describeKey(key)}:{' '}
                  {t(messageKeyForCode(codes[0] ?? failure.code), MESSAGE_PARAMS)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {fields && (
        <div className="space-y-3">
          <DataSourceMappingTable
            fields={fields}
            assignments={assignments}
            targets={targets}
            targetLabel={targetLabel}
            targetsUsedElsewhere={targetsUsedElsewhere}
            onAssign={handleAssign}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreview}
              disabled={isPending}
            >
              {t('mapping.preview')}
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? t('mapping.saving') : t('mapping.save')}
            </Button>
          </div>

          {status.kind === 'saved' && (
            <p role="status" className="text-sm text-success">
              {t('mapping.saved')}
            </p>
          )}

          {status.kind === 'previewed' && (
            <div className="rounded-token border border-border bg-surface p-3">
              <p className="mb-1.5 text-xs font-medium text-copy-muted">
                {t('mapping.previewTitle')}
              </p>
              <pre className="overflow-x-auto text-xs text-copy">{status.json}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
