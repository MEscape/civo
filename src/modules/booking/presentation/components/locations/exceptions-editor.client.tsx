'use client';

import { useId } from 'react';

import { ConfirmDialog } from '@components/shared/dialog';
import { PaginationButtons } from '@components/shared/pagination-buttons.client';

import { useTranslations } from '@i18n/client';

import { errorsUnder } from '../../forms/field-errors';
import { EXCEPTIONS_PAGE_SIZE, useExceptionsEditor } from '../../hooks/use-exceptions-editor';
import { useHolidayImport } from '../../hooks/use-holiday-import';

import { ExceptionDialog } from './exception-dialog.client';
import { ExceptionsImport } from './exceptions-import.client';
import { ExceptionsTable } from './exceptions-table.client';
import { ExceptionsToolbar } from './exceptions-toolbar.client';

import type { ExceptionInputDto } from '../../dto/location-dto';

export interface ExceptionsEditorProps {
  readonly value: readonly ExceptionInputDto[];
  readonly onChange: (exceptions: ExceptionInputDto[]) => void;
  /** The messages of the exceptions' fields, by path inside the list (`0.from`), already translated. */
  readonly errors: Readonly<Record<string, string>>;
  /** The years holidays can be imported for. */
  readonly years: readonly number[];
}

/**
 * The dated exceptions of a location: a filterable, paged table, with a dialog to add or change one
 * (checked by the server's own rules before it joins the list), a dialog to import the holidays of a
 * state, and a confirmation before one is removed. An exception replaces the weekly hours of its days.
 * The list is the form's value; nothing is stored until the location is saved.
 */
export function ExceptionsEditor({ value, onChange, errors, years }: ExceptionsEditorProps) {
  const t = useTranslations('booking');
  const idPrefix = useId();
  const holidays = useHolidayImport(value, onChange, years);
  const list = useExceptionsEditor(value, (next) => {
    holidays.forget();
    onChange(next);
  });
  const last = Math.min(list.firstShown + EXCEPTIONS_PAGE_SIZE - 1, list.rows.length);

  return (
    <div className="space-y-4">
      <p className="text-sm text-copy-muted">{t('exceptions.hint')}</p>

      <ExceptionsToolbar
        tab={list.tab}
        counts={list.counts}
        onSelectTab={list.selectTab}
        onAdd={list.startAdd}
        onImport={holidays.open}
      />

      <div className="overflow-hidden rounded-token border border-border bg-surface">
        <ExceptionsTable
          rows={list.shown}
          empty={list.isEmpty ? t('exceptions.empty') : t('exceptions.emptyTab')}
          messageOf={(index) => Object.values(errorsUnder(errors, index))[0]}
          onEdit={list.startEdit}
          onRemove={list.askToRemove}
        />
        {list.rows.length > 0 && (
          // Always the same strip under the rows: what is shown (or what an import just did) on the left, the pages on the right.
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-canvas px-4 py-3 text-sm text-copy-muted">
            <p role="status">
              {holidays.added === null
                ? t('exceptions.showing', {
                    from: list.firstShown,
                    to: last,
                    total: list.rows.length,
                  })
                : t(holidays.added === 0 ? 'exceptions.import.none' : 'exceptions.import.added', {
                    count: holidays.added,
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
        idPrefix={`${idPrefix}-exception`}
        onChange={list.changeDraft}
        onSave={list.saveDraft}
        onCancel={list.cancelDraft}
      />
      <ExceptionsImport
        open={holidays.isOpen}
        region={holidays.region}
        year={holidays.year}
        years={years}
        onRegion={holidays.setRegion}
        onYear={holidays.setYear}
        onApply={holidays.apply}
        onCancel={holidays.close}
      />
      <ConfirmDialog
        open={list.pendingRemoval !== null}
        title={t('exceptions.removeTitle')}
        description={t('exceptions.removeBody')}
        confirmLabel={t('exceptions.removeConfirm')}
        cancelLabel={t('exceptions.removeCancel')}
        onCancel={list.cancelRemoval}
        onConfirm={list.confirmRemoval}
      />
    </div>
  );
}
