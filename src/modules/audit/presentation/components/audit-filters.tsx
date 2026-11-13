import { CheckboxField } from '@components/shared/field';
import {
  ANY_FILTER_VALUE,
  FilterBar,
  FilterChips,
  FilterSelect,
} from '@components/shared/filter-bar';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { buildQueryString } from '@lib/utils';

import {
  AUDIT_PERIODS,
  AUDIT_SOURCES,
  EMPTY_AUDIT_FILTER,
} from '../../application/contracts/audit-views';
import { SOURCE_MESSAGE_KEYS } from '../entries/audit-labels';
import { auditParamsOf, whoValueOf } from '../schemas/audit-filter-schema';

import type {
  AuditFilter,
  AuditSource,
  AuditTypeCountView,
} from '../../application/contracts/audit-views';
import type { AuditTranslator } from '../translation/translator';

/** The value of an "any" choice: a select item cannot be empty. */
export const ANY_CHOICE = ANY_FILTER_VALUE;

export interface AuditFiltersProps {
  readonly locale: Locale;
  /** The page address without its query: the filters are links and a GET form back to it. */
  readonly pathname: string;
  readonly filter: AuditFilter;
  /** The page size in use; applying the filters keeps it. */
  readonly pageSize: number;
  /** Matching entries per type in the chosen period, whatever area and event are chosen. */
  readonly types: readonly AuditTypeCountView[];
  readonly eventLabels: Readonly<Record<string, string>>;
  /** The members who appear in the trail, with their names. */
  readonly members: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  /** The platform-wide trail offers a website to narrow it to; a website's own trail does not. */
  readonly websites?: ReadonlyArray<{ readonly id: string; readonly name: string }> | undefined;
}

/** Keep applied choices available even when their event or member no longer appears in the options. */
function choicesOf({
  locale,
  filter,
  types,
  eventLabels,
  members,
  t,
}: Pick<AuditFiltersProps, 'locale' | 'filter' | 'types' | 'eventLabels' | 'members'> & {
  readonly t: AuditTranslator;
}) {
  const labelOf = (type: string) => eventLabels[type] ?? type;
  const eventOptions = types
    .filter((entry) => filter.source === null || entry.source === filter.source)
    .map((entry) => ({
      value: entry.type,
      label:
        filter.source === null
          ? t('filters.eventInArea', {
              area: t(SOURCE_MESSAGE_KEYS[entry.source]),
              label: labelOf(entry.type),
              count: entry.count,
            })
          : t('filters.eventOption', { label: labelOf(entry.type), count: entry.count }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  if (filter.type !== null && !eventOptions.some((option) => option.value === filter.type)) {
    eventOptions.unshift({ value: filter.type, label: labelOf(filter.type) });
  }

  const whoOptions = [
    { value: ANY_CHOICE, label: t('filters.anyone') },
    { value: 'visitor', label: t('filters.visitors') },
    { value: 'system', label: t('filters.system') },
    ...members.map((member) => ({ value: `member:${member.id}`, label: member.name })),
  ];
  const who = whoValueOf(filter.actor);
  if (who !== undefined && !whoOptions.some((option) => option.value === who)) {
    whoOptions.push({ value: who, label: t('actors.formerMember') });
  }
  return { eventOptions, whoOptions, who };
}

/**
 * The trail's filters. The areas are links with their counts, so one click
 * narrows the list and the numbers say where to look; the rest is a plain GET
 * form whose event list holds only events that happened in the chosen area
 * and period. The state is the address: a filtered view can be shared.
 */
export async function AuditFilters({
  locale,
  pathname,
  filter,
  pageSize,
  types,
  eventLabels,
  members,
  websites,
}: AuditFiltersProps) {
  const t = await getTranslations<'audit'>({ locale, namespace: 'audit' });
  const countOf = (source: AuditSource | null) =>
    types
      .filter((entry) => source === null || entry.source === source)
      .reduce((sum, entry) => sum + entry.count, 0);
  // Choosing an area starts its events afresh: an event belongs to one area.
  const areaHref = (source: AuditSource | null) =>
    `${pathname}${buildQueryString(auditParamsOf({ ...filter, source, type: null }))}`;
  const areas = [
    null,
    ...AUDIT_SOURCES.filter((source) => countOf(source) > 0 || source === filter.source),
  ];

  const { eventOptions, whoOptions, who } = choicesOf({
    locale,
    filter,
    types,
    eventLabels,
    members,
    t,
  });

  return (
    <div className="divide-y divide-border border-b border-border">
      <div className="px-4 py-3">
        <FilterChips
          label={t('filters.areas')}
          chips={areas.map((source) => ({
            key: source ?? 'all',
            href: areaHref(source),
            isActive: source === filter.source,
            label: t('filters.areaCount', {
              label: source === null ? t('sources.all') : t(SOURCE_MESSAGE_KEYS[source]),
              count: countOf(source),
            }),
          }))}
        />
      </div>

      {/*
       * The fields only take their starting value when they mount. Links (an
       * area, "everything by …", reset) change the filter without a reload, so
       * the form is keyed by the filter: a new filter is a new form.
       */}
      <FilterBar
        key={JSON.stringify(auditParamsOf(filter))}
        action={pathname}
        label={t('filters.label')}
        applyLabel={t('filters.apply')}
        resetLabel={t('filters.reset')}
        resetHref={`${pathname}${buildQueryString(auditParamsOf(EMPTY_AUDIT_FILTER))}`}
        className="px-4 py-3"
      >
        {filter.source !== null && <input type="hidden" name="area" value={filter.source} />}
        <input type="hidden" name="pageSize" value={pageSize} />
        {websites !== undefined && (
          <FilterSelect
            id="audit-website"
            name="website"
            label={t('filters.website')}
            options={[
              { value: ANY_CHOICE, label: t('filters.anyWebsite') },
              ...websites.map((website) => ({ value: website.id, label: website.name })),
            ]}
            defaultValue={filter.websiteId ?? ANY_CHOICE}
          />
        )}
        <FilterSelect
          id="audit-event"
          name="event"
          label={t('filters.event')}
          options={[{ value: ANY_CHOICE, label: t('filters.anyEvent') }, ...eventOptions]}
          defaultValue={filter.type ?? ANY_CHOICE}
          className="min-w-56 flex-1"
        />
        <FilterSelect
          id="audit-who"
          name="who"
          label={t('filters.who')}
          options={whoOptions}
          defaultValue={who ?? ANY_CHOICE}
        />
        <FilterSelect
          id="audit-period"
          name="period"
          label={t('filters.period')}
          options={AUDIT_PERIODS.map((period) => ({
            value: period,
            label: t(`periods.${period}`),
          }))}
          defaultValue={filter.period}
        />
        <div className="flex h-9 items-center px-1">
          <CheckboxField
            id="audit-warnings"
            name="warnings"
            value="1"
            label={t('filters.onlyWarnings')}
            defaultChecked={filter.onlyWarnings}
          />
        </div>
      </FilterBar>
    </div>
  );
}
