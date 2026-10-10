import { Button } from '@components/ui/button';
import { Icons } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

export interface MonthHeaderProps {
  readonly headingId: string;
  readonly label: string;
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
  readonly disabled: boolean;
  readonly onMove: (delta: number) => void;
}

/** The month being shown and the two buttons that page through months. */
export function MonthHeader({
  headingId,
  label,
  canGoBack,
  canGoForward,
  disabled,
  onMove,
}: MonthHeaderProps) {
  const t = useTranslations('booking');

  return (
    <div className="flex items-center justify-between gap-2">
      <h3 id={headingId} className="text-base font-medium text-copy" aria-live="polite">
        {label}
      </h3>
      <div className="flex gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onMove(-1);
          }}
          disabled={!canGoBack || disabled}
          aria-label={t('time.previousMonth')}
        >
          <Icons.chevronLeft aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onMove(1);
          }}
          disabled={!canGoForward || disabled}
          aria-label={t('time.nextMonth')}
        >
          <Icons.chevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
