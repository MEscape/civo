import { Check, Circle, Mail } from '@components/icons/icons';
import { DataPanel } from '@components/shared/data-panel';
import { Pagination } from '@components/shared/pagination';
import { ResponsiveTable } from '@components/shared/responsive-table';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildQueryString } from '@lib/utils';

import { createZonedFormat } from '../../hooks/use-zoned-format';
import { bookingRoutes } from '../../routes';
import { BookingEmptyState } from '../shared/booking-empty-state';
import { StatusChip } from '../shared/status-chip';

import { MarkReadButton } from './mark-read-button.client';
import { MessageLine } from './message-line';

import type { MessagePageDto } from '../../dto/employee-dto';

export interface MessagesListProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly page: MessagePageDto;
}

/**
 * The inbox a page at a time, in the table every list is: the days are headings (today, yesterday, then
 * the date), each message says in words whether it is new, and marking one read is its own action.
 */
export async function MessagesList({ locale, websiteId, page }: MessagesListProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const format = createZonedFormat(locale);
  const base = bookingRoutes.meMessages(websiteId);
  const dayTitle = (day: string) => {
    if (day === page.today) {
      return t('employee.messages.today');
    }
    return day === page.yesterday ? t('employee.messages.yesterday') : format.calendarDate(day);
  };

  return (
    <DataPanel
      title={t('employee.messages.panelTitle')}
      meta={t('employee.messages.unread', { count: page.unread })}
      actions={
        page.unread > 0 ? (
          <MarkReadButton messageId={null} label={t('employee.messages.markAll')} />
        ) : undefined
      }
      footer={
        page.pageCount > 1 ? (
          <Pagination
            locale={locale}
            slice={page}
            hrefFor={(target) => `${base}${buildQueryString({ page: target })}`}
            label={t('employee.messages.pagination')}
          />
        ) : undefined
      }
    >
      <ResponsiveTable
        label={t('employee.messages.panelTitle')}
        rows={page.items}
        rowKey={({ id }) => id}
        density="standard"
        groupHeading={(message, previous) =>
          previous?.day === message.day ? null : dayTitle(message.day)
        }
        columns={[
          {
            id: 'state',
            label: t('employee.messages.columns.state'),
            width: '@3xl:w-28',
            cell: ({ isRead }) =>
              isRead ? (
                <StatusChip tone="muted" icon={Check}>
                  {t('employee.messages.read')}
                </StatusChip>
              ) : (
                <StatusChip tone="info" icon={Circle}>
                  {t('employee.messages.new')}
                </StatusChip>
              ),
          },
          {
            id: 'message',
            label: t('employee.messages.columns.message'),
            isTitle: true,
            cell: (message) => <MessageLine message={message} />,
          },
          {
            id: 'time',
            label: t('employee.messages.columns.time'),
            width: '@3xl:w-24',
            cell: (message) => (
              <span className="text-sm text-copy-muted">
                {format.time(message.createdAt, message.timeZone)}
              </span>
            ),
          },
          {
            id: 'mark',
            label: t('employee.messages.markOne'),
            isAction: true,
            width: '@3xl:w-36',
            cell: (message) =>
              message.isRead ? null : (
                <div className="flex justify-end">
                  <MarkReadButton
                    messageId={message.id}
                    label={t('employee.messages.markOne')}
                    accessibleName={t('employee.messages.markOneNamed', {
                      what: t(`employee.messages.type.${message.type}`),
                      time: format.time(message.createdAt, message.timeZone),
                    })}
                  />
                </div>
              ),
          },
        ]}
        state={{
          kind: 'ready',
          empty: (
            <BookingEmptyState
              icon={<Mail aria-hidden="true" />}
              title={t('employee.messages.empty')}
              description={t('employee.messages.emptyBody')}
            />
          ),
        }}
      />
    </DataPanel>
  );
}
