import { useTranslations } from '@i18n/client';

import { INFORMATION_FIELDS } from '../../../application/contracts/booking-constraints';
import { INFORMATION_FIELD_MESSAGE_KEYS } from '../../messages/message-keys';

import type { InformationDraft } from '../../drafts/service-draft';

export interface VisitorFormPreviewProps {
  readonly information: InformationDraft;
  readonly documents: string;
  readonly instructions: string;
}

/**
 * What a visitor will meet in the booking form, as the editor has set it up:
 * the questions in their order, which are required, the documents to bring
 * and the note. It reads the same draft the form saves, so it cannot drift
 * from what is stored; it is a picture, not a form, so it takes no input.
 */
export function VisitorFormPreview({
  information,
  documents,
  instructions,
}: VisitorFormPreviewProps) {
  const t = useTranslations('booking');
  const asked = INFORMATION_FIELDS.filter((field) => information[field].enabled);
  const bring = documents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const note = instructions.trim();

  return (
    <section
      aria-labelledby="visitor-preview-title"
      className="space-y-2 rounded-token border border-border bg-canvas p-3"
    >
      <h4 id="visitor-preview-title" className="text-sm font-medium text-copy">
        {t('services.preview.title')}
      </h4>
      <ul className="space-y-1 text-sm text-copy">
        {asked.map((field) => (
          <li key={field} className="flex items-baseline justify-between gap-3">
            <span>{t(INFORMATION_FIELD_MESSAGE_KEYS[field])}</span>
            <span className="text-xs text-copy-muted">
              {information[field].isRequired
                ? t('services.preview.required')
                : t('services.preview.optional')}
            </span>
          </li>
        ))}
      </ul>
      {bring.length > 0 && (
        <div className="text-sm text-copy">
          <p className="font-medium">{t('services.preview.documents')}</p>
          <ul className="list-disc pl-5">
            {bring.map((line, position) => (
              // Lines are plain text and may repeat; their position is their identity here.
              // eslint-disable-next-line react/no-array-index-key -- see above
              <li key={`${position}-${line}`}>{line}</li>
            ))}
          </ul>
        </div>
      )}
      {note !== '' && (
        <p className="text-sm text-copy">
          <span className="font-medium">{t('services.preview.instructions')}</span> {note}
        </p>
      )}
    </section>
  );
}
