'use client';

import { useId } from 'react';

import { Trash2 } from '@components/icons/icons';
import { ConfirmDialog, DialogNotice } from '@components/shared/dialog';
import { ResponsiveTable } from '@components/shared/responsive-table';
import { SelectField } from '@components/shared/select-field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useCoverageEditor } from '../../hooks/use-coverage-editor';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { DateField } from '../shared/date-field.client';

import type { LocationNameDto } from '../../dto/service-dto';
import type { CoverageInputDto } from '../../dto/team-dto';

export interface CoverageEditorProps {
  readonly value: readonly CoverageInputDto[];
  readonly onChange: (spells: CoverageInputDto[]) => void;
  /** The employee's own location: they cannot be sent there. */
  readonly home: string;
  /** The other locations a manager can send them to. */
  readonly choices: readonly LocationNameDto[];
  readonly disabled?: boolean | undefined;
}

/**
 * Where a manager sends an employee for some days, kept the way absences are: a short table, a dialog
 * to add or change one that checks it against the server's rules before it joins the list, and a
 * question before one goes. Nothing is saved until the calendar is.
 */
export function CoverageEditor({
  value,
  onChange,
  home,
  choices,
  disabled = false,
}: CoverageEditorProps) {
  const t = useTranslations('booking');
  const zoned = useZonedFormat();
  const idPrefix = useId();
  const editor = useCoverageEditor(value, onChange, {
    home,
    locationIds: choices.map(({ id }) => id),
  });
  const nameOf = (id: string) => choices.find((choice) => choice.id === id)?.name ?? id;
  const periodOf = ({ from, to }: CoverageInputDto) =>
    from === to
      ? zoned.calendarDate(from)
      : t('exceptions.range', { from: zoned.calendarDate(from), to: zoned.calendarDate(to) });
  const problem = (field: string) => {
    const code = editor.problems[field];
    return code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);
  };
  const hasProblems = Object.keys(editor.problems).length > 0;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={disabled || choices.length === 0}
          onClick={editor.startAdd}
        >
          {t('team.coverage.add')}
        </Button>
      </div>
      {choices.length === 0 && (
        <p className="text-sm text-copy-muted">{t('team.coverage.noPlaces')}</p>
      )}
      <div className="overflow-hidden rounded-token border border-border bg-surface">
        <ResponsiveTable
          label={t('team.coverage.title')}
          rows={value}
          rowKey={(spell) => `${spell.locationId}-${spell.from}-${spell.to}`}
          density="standard"
          state={{
            kind: 'ready',
            empty: (
              <p className="p-6 text-center text-sm text-copy-muted">{t('team.coverage.none')}</p>
            ),
          }}
          columns={[
            {
              id: 'location',
              label: t('team.coverage.columns.location'),
              isTitle: true,
              width: '@3xl:w-1/3',
              cell: (spell) => (
                <span className="font-medium text-copy">{nameOf(spell.locationId)}</span>
              ),
            },
            {
              id: 'period',
              label: t('team.coverage.columns.period'),
              cell: periodOf,
            },
            {
              id: 'actions',
              label: t('exceptions.columns.actions'),
              isAction: true,
              cell: (spell) => {
                const index = value.indexOf(spell);
                return (
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      aria-label={t('team.coverage.editNamed', {
                        location: nameOf(spell.locationId),
                      })}
                      onClick={() => {
                        editor.startEdit(index);
                      }}
                    >
                      {t('team.coverage.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive-ghost"
                      size="icon-sm"
                      disabled={disabled}
                      aria-label={t('team.coverage.removeNamed', {
                        location: nameOf(spell.locationId),
                      })}
                      onClick={() => {
                        editor.askToRemove(index);
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                );
              },
            },
          ]}
        />
      </div>
      <ConfirmDialog
        open={editor.spell !== null}
        title={editor.isNew ? t('team.coverage.addTitle') : t('team.coverage.editTitle')}
        description={t('team.coverage.dialogHint')}
        confirmLabel={editor.isNew ? t('team.coverage.add') : t('team.coverage.edit')}
        confirmVariant="default"
        cancelLabel={t('exceptions.removeCancel')}
        onConfirm={editor.save}
        onCancel={editor.cancel}
      >
        {editor.spell !== null && (
          <div className="space-y-4">
            {hasProblems && (
              <DialogNotice tone="danger">{t('team.coverage.problems')}</DialogNotice>
            )}
            <SelectField
              id={`${idPrefix}-location`}
              label={t('team.coverage.location')}
              placeholder={t('team.coverage.locationPlaceholder')}
              value={editor.spell.locationId}
              options={choices.map(({ id, name }) => ({ value: id, label: name }))}
              errorMessage={problem('locationId')}
              onValueChange={(locationId) => {
                if (editor.spell !== null) {
                  editor.change({ ...editor.spell, locationId });
                }
              }}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <DateField
                id={`${idPrefix}-from`}
                label={t('team.coverage.from')}
                value={editor.spell.from}
                error={problem('from')}
                onValueChange={(from) => {
                  if (editor.spell !== null) {
                    editor.change({ ...editor.spell, from });
                  }
                }}
              />
              <DateField
                id={`${idPrefix}-to`}
                label={t('team.coverage.to')}
                value={editor.spell.to}
                error={problem('to') === problem('from') ? undefined : problem('to')}
                onValueChange={(to) => {
                  if (editor.spell !== null) {
                    editor.change({ ...editor.spell, to });
                  }
                }}
              />
            </div>
          </div>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={editor.pendingRemoval !== null}
        title={t('team.coverage.removeTitle')}
        description={t('team.coverage.removeBody')}
        confirmLabel={t('exceptions.removeConfirm')}
        cancelLabel={t('exceptions.removeCancel')}
        onCancel={editor.cancelRemoval}
        onConfirm={editor.confirmRemoval}
      />
    </div>
  );
}
