'use client';

import { useTranslations } from '@i18n/client';

import { stringifyJson, truncate } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import type { FieldConflict } from '../../application/contracts/release-views';

/** A prop can hold a long text; the reviewer needs to recognise it, not read all of it. */
const MAX_DISPLAYED_VALUE_LENGTH = 120;

interface ValueLineProps {
  readonly label: string;
  readonly value: JsonValue | undefined;
  readonly absentLabel: string;
}

function ValueLine({ label, value, absentLabel }: ValueLineProps) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-copy-muted">{label}</dt>
      <dd className="min-w-0 break-words text-copy">
        {value === undefined ? (
          <span className="text-copy-muted">{absentLabel}</span>
        ) : (
          <code>{truncate(stringifyJson(value), MAX_DISPLAYED_VALUE_LENGTH)}</code>
        )}
      </dd>
    </div>
  );
}

export interface ConflictValuesProps {
  readonly conflict: FieldConflict;
}

/**
 * The three versions of a setting, as text (React escapes them): stored
 * props are never rendered as HTML.
 */
export function ConflictValues({ conflict }: ConflictValuesProps) {
  const t = useTranslations('release.migration.conflict');
  const absentLabel = t('absent');

  return (
    <dl className="space-y-1 text-xs">
      <ValueLine label={t('original')} value={conflict.base} absentLabel={absentLabel} />
      <ValueLine label={t('yours')} value={conflict.local} absentLabel={absentLabel} />
      {conflict.kind === 'both_changed' && (
        <ValueLine label={t('incoming')} value={conflict.incoming} absentLabel={absentLabel} />
      )}
    </dl>
  );
}
