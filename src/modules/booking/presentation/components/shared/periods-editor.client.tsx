'use client';

import { useId } from 'react';

import { ConfirmDialog } from '@components/shared/dialog';
import { PaginationButtons } from '@components/shared/pagination-buttons.client';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { errorsUnder } from '../../forms/field-errors';
import { EXCEPTIONS_PAGE_SIZE, useExceptionsEditor } from '../../hooks/use-exceptions-editor';
import { ExceptionDialog } from '../locations/exception-dialog.client';
import { ExceptionsTable } from '../locations/exceptions-table.client';

import type { ExceptionInputDto } from '../../dto/location-dto';

const CLOSED_ONLY = ['closed'] as const;

export interface PeriodsEditorProps {
  /** The periods: closed days, each a run from `from` to `to`. */
  readonly value: readonly ExceptionInputDto[];
  readonly onChange: (periods: ExceptionInputDto[]) => void;
  /** The messages by path inside the list (`0.from`), already translated. */
  readonly errors: Readonly<Record<string, string>>;
  readonly disabled?: boolean | undefined;
  /** Where its words are: a resource's blocked periods, or an employee's absences. */
  readonly words: 'resources.form.blocks' | 'team.absences';
}

/**
 * The closed periods of a resource or an employee, kept the way a location keeps its exceptions: a
 * short table (paged once it is long), a dialog to add or change one that checks it against the same
 * rules before it joins the list, and a question before one goes. The list never holds a blank row,
 * so a long list does not push the form down and nothing half-filled is left to be forgotten.
 */
export function PeriodsEditor({
  value,
  onChange,
  errors,
  disabled = false,
  words,
}: PeriodsEditorProps) {
  const t = useTranslations('booking');
  const idPrefix = useId();
  const list = useExceptionsEditor(value, onChange);
  const last = Math.min(list.firstShown + EXCEPTIONS_PAGE_SIZE - 1, list.rows.length);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={disabled} onClick={list.startAdd}>
          {t(`${words}.add`)}
        </Button>
      </div>
      <div className="overflow-hidden rounded-token border border-border bg-surface">
        <ExceptionsTable
          variant="periods"
          rows={list.shown}
          empty={t(`${words}.none`)}
          messageOf={(index) => Object.values(errorsUnder(errors, index))[0]}
          onEdit={list.startEdit}
          onRemove={list.askToRemove}
        />
        {list.rows.length > EXCEPTIONS_PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-canvas px-4 py-3 text-sm text-copy-muted">
            <p role="status">
              {t('exceptions.showing', {
                from: list.firstShown,
                to: last,
                total: list.rows.length,
              })}
            </p>
            <PaginationButtons
              page={list.page}
              pageCount={list.pageCount}
              onPage={list.goToPage}
              label={t('exceptions.pager.label')}
            />
          </div>
        )}
      </div>
      <ExceptionDialog
        exception={list.draft}
        isNew={list.isDraftNew}
        problems={list.draftProblems}
        idPrefix={`${idPrefix}-period`}
        kinds={CLOSED_ONLY}
        words={{
          addTitle: t(`${words}.addTitle`),
          editTitle: t(`${words}.editTitle`),
          description: t(`${words}.description`),
          add: t(`${words}.add`),
          problems: t(`${words}.problems`),
        }}
        onChange={list.changeDraft}
        onSave={list.saveDraft}
        onCancel={list.cancelDraft}
      />
      <ConfirmDialog
        open={list.pendingRemoval !== null}
        title={t(`${words}.removeTitle`)}
        description={t(`${words}.removeBody`)}
        confirmLabel={t('exceptions.removeConfirm')}
        cancelLabel={t('exceptions.removeCancel')}
        onCancel={list.cancelRemoval}
        onConfirm={list.confirmRemoval}
      />
    </div>
  );
}
