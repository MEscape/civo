'use client';

import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';

import type { MessageDto } from '../../dto/employee-dto';

export interface MessageLineProps {
  readonly message: MessageDto;
}

/**
 * What a message says, worded here from its type ("Termin zugewiesen") and what it is about: the
 * booking (service, day and time on the location's clock, location) or the parts of the calendar a
 * manager changed. The stored message holds no text.
 */
export function MessageLine({ message }: MessageLineProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat();
  const about =
    message.type === 'calendar_changed'
      ? [
          t('employee.messages.calendarAbout', {
            parts: message.parts
              .map((part) => t(`employee.messages.calendarParts.${part}`))
              .join(', '),
          }),
          message.locationName,
        ]
      : [
          message.serviceName ?? t('employee.unnamedService'),
          format.dateTime(message.start, message.timeZone),
          message.locationName,
        ];

  return (
    <div className="min-w-0">
      <p className="font-medium text-copy">{t(`employee.messages.type.${message.type}`)}</p>
      <p className="text-sm text-copy-muted">{about.filter(Boolean).join(' · ')}</p>
    </div>
  );
}
