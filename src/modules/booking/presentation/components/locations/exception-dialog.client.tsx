'use client';

import { ConfirmDialog, DialogNotice } from '@components/shared/dialog';

import { useTranslations } from '@i18n/client';

import { EXCEPTION_KINDS } from '../../../application/contracts/booking-constraints';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

import { ExceptionFields } from './exception-fields.client';

import type { ExceptionInputDto } from '../../dto/location-dto';
import type { BookingTranslator } from '../../translation/translator';

export interface ExceptionDialogProps {
  /** The exception being made or changed; `null` closes the dialog. */
  readonly exception: ExceptionInputDto | null;
  readonly isNew: boolean;
  /** The codes that stop it from being saved, by path inside it; empty until a save was tried. */
  readonly problems: Readonly<Record<string, string>>;
  readonly idPrefix: string;
  readonly onChange: (exception: ExceptionInputDto) => void;
  readonly onSave: () => void;
  readonly onCancel: () => void;
  /** The kinds one can choose from; with one only (a blocked period, an absence) the choice is not shown. */
  readonly kinds?: ReadonlyArray<ExceptionInputDto['kind']> | undefined;
  /** The words of a dialog that is not about the location's exceptions: its titles, its hint and its buttons. */
  readonly words?: ExceptionDialogWords | undefined;
}

/** The words of the dialog about the location's own exceptions. */
const defaultWords = (t: BookingTranslator): ExceptionDialogWords => ({
  addTitle: t('exceptions.addTitle'),
  editTitle: t('exceptions.editTitle'),
  description: t('exceptions.hint'),
  add: t('exceptions.add'),
  problems: t('exceptions.problems'),
});

export interface ExceptionDialogWords {
  readonly addTitle: string;
  readonly editTitle: string;
  readonly description: string;
  readonly add: string;
  readonly problems: string;
}

/**
 * One exception in a dialog of its own: its kind, the days it covers and (unless it closes) its hours.
 * It is only added to the list once the rules accept it, and what they refuse is shown here, beside
 * the fields, the moment a save is tried and until it is put right: nothing is left to find further up the page.
 */
export function ExceptionDialog({
  exception,
  isNew,
  problems,
  idPrefix,
  onChange,
  onSave,
  onCancel,
  kinds = EXCEPTION_KINDS,
  words,
}: ExceptionDialogProps) {
  const t = useTranslations('booking');
  const text = { ...defaultWords(t), ...words };
  const errors = Object.fromEntries(
    Object.entries(problems).map(([path, code]) => [
      path,
      t(messageKeyForCode(code), MESSAGE_PARAMS),
    ]),
  );

  return (
    <ConfirmDialog
      open={exception !== null}
      confirmVariant="default"
      size="lg"
      title={isNew ? text.addTitle : text.editTitle}
      description={text.description}
      confirmLabel={isNew ? text.add : t('exceptions.save')}
      cancelLabel={t('exceptions.cancel')}
      onConfirm={onSave}
      onCancel={onCancel}
    >
      {exception !== null && (
        <div className="space-y-4">
          {Object.keys(errors).length > 0 && (
            <DialogNotice tone="danger">{text.problems}</DialogNotice>
          )}
          <ExceptionFields
            exception={exception}
            errors={errors}
            kinds={kinds}
            idPrefix={idPrefix}
            onChange={onChange}
          />
        </div>
      )}
    </ConfirmDialog>
  );
}
