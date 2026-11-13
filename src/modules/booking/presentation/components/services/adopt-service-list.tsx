import { Check, Circle } from '@components/icons/icons';
import { DataPanel } from '@components/shared/data-panel';
import { FilterBar, FilterSearchField, FilterSelect } from '@components/shared/filter-bar';
import { Pagination } from '@components/shared/pagination';

import type { Locale } from '@i18n';
import { Link } from '@i18n';

import { getTranslations } from '@i18n/server';

import { cn, isDefined } from '@lib/utils';

import { adoptHref } from '../../forms/service-list-href';
import { ANY_FILTER } from '../../schemas/parse-service-list-input';

import type { AdoptablePageDto } from '../../dto/service-dto';
import type { AdoptView } from '../../forms/service-list-href';

export interface AdoptServiceListProps {
  readonly locale: Locale;
  /** The adopt screen's own address. */
  readonly base: string;
  readonly page: AdoptablePageDto;
  readonly view: AdoptView;
}

/**
 * Step one of taking a service over: the services other locations offer, found by name or by the
 * location they come from, a page at a time. Picking one is a link, so the choice is in the address
 * and survives filtering, paging and a reload; the picked row says so in words and with a tick.
 */
export async function AdoptServiceList({ locale, base, page, view }: AdoptServiceListProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });

  return (
    <DataPanel
      title={t('services.adopt.step1')}
      meta={t('services.adopt.count', { count: page.total })}
      footer={
        page.pageCount > 1 ? (
          <Pagination
            locale={locale}
            slice={page}
            hrefFor={(target) => adoptHref(base, view, { page: target })}
            label={t('services.adopt.pagination')}
          />
        ) : undefined
      }
    >
      <div className="border-b border-border px-4 py-3">
        <FilterBar
          key={JSON.stringify(view)}
          action={base}
          label={t('services.adopt.filterLabel')}
          applyLabel={t('services.filters.apply')}
          resetLabel={t('services.filters.reset')}
          resetHref={base}
        >
          <FilterSearchField
            id="adopt-q"
            name="q"
            label={t('services.adopt.searchLabel')}
            placeholder={t('services.adopt.searchPlaceholder')}
            defaultValue={view.search ?? ''}
          />
          <FilterSelect
            id="adopt-source"
            name="source"
            label={t('services.adopt.sourceLabel')}
            defaultValue={view.source ?? ANY_FILTER}
            options={[
              { value: ANY_FILTER, label: t('services.adopt.sourceAny') },
              ...page.sources.map((source) => ({ value: source.id, label: source.name })),
            ]}
          />
          <input type="hidden" name="pageSize" value={view.pageSize} />
        </FilterBar>
      </div>

      {page.isTruncated && (
        <p role="status" className="border-b border-border px-4 py-2 text-xs text-copy-muted">
          {t('services.list.truncated')}
        </p>
      )}

      {page.items.length === 0 ? (
        <p className="p-4 text-sm text-copy-muted">{t('services.adopt.none')}</p>
      ) : (
        <ul aria-label={t('services.adopt.listLabel')} className="divide-y divide-border">
          {page.items.map((service) => {
            const isPicked = view.service === service.id;
            const from = service.source?.id ?? '';
            return (
              <li key={service.id}>
                <Link
                  href={adoptHref(base, view, { pick: { service: service.id, from } })}
                  aria-current={isPicked ? 'true' : undefined}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3 outline-none hover:bg-canvas focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset',
                    isPicked && 'bg-canvas',
                  )}
                >
                  {isPicked ? (
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-primary-copy"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle className="mt-0.5 size-4 shrink-0 text-copy-muted" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-copy">{service.name}</span>
                    <span className="block text-xs text-copy-muted">
                      {[
                        service.source?.name,
                        t('services.duration', { minutes: service.durationMinutes }),
                      ]
                        .filter(isDefined)
                        .join(' · ')}
                    </span>
                  </span>
                  {service.category !== null && (
                    <span className="text-xs text-copy-muted">{service.category}</span>
                  )}
                  {isPicked && <span className="sr-only">{t('services.adopt.picked')}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DataPanel>
  );
}
