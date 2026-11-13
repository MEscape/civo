'use client';

import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

export interface ReviewNotesProps {
  /** What is worth knowing before saving, worked out from the values; none blocks saving. */
  readonly notes: readonly string[];
}

/**
 * The notes under the summary of a last step ("Notes before saving"): the same box, title and wording on
 * every wizard's review, a calm one while there is nothing to say and a warning while there is.
 */
export function ReviewNotes({ notes }: ReviewNotesProps) {
  const t = useTranslations('booking');

  return (
    <Alert variant={notes.length === 0 ? 'default' : 'warning'}>
      <AlertTitle>{t('review.hintsTitle')}</AlertTitle>
      <AlertDescription>
        {notes.length === 0 ? (
          t('review.noHints')
        ) : (
          <ul className="list-disc space-y-1 ps-5">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
