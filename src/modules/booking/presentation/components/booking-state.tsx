import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';

import { getTranslations } from '@i18n/server';

export type BookingStateKind = 'empty' | 'empty-draft' | 'unavailable';

export interface BookingStateProps {
  readonly kind: BookingStateKind;
  readonly heading: string;
}

const VARIANT = {
  empty: 'info',
  'empty-draft': 'info',
  unavailable: 'danger',
} as const satisfies Record<BookingStateKind, 'info' | 'danger'>;

/**
 * What the component shows instead of the flow: nothing to book yet, the
 * catalog could not be read. Each has its own words, so a visitor is never shown
 * editor instructions and an editor is told what to do next.
 */
export async function BookingState({ kind, heading }: BookingStateProps) {
  const t = await getTranslations('booking');
  return (
    <section aria-label={heading}>
      <Alert variant={VARIANT[kind]}>
        <AlertTitle>{heading}</AlertTitle>
        <AlertDescription>{t(`state.${kind}`)}</AlertDescription>
      </Alert>
    </section>
  );
}
