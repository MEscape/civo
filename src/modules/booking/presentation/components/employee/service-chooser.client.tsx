'use client';

import { useState } from 'react';

import { Close, Search } from '@components/icons/icons';
import { CheckboxField } from '@components/shared/field';
import { Button } from '@components/ui/button';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { serviceGroups } from '../../forms/preferences';

import type { PreferencesDto } from '../../dto/employee-dto';

/** How many chosen services are named as chips above the list; the rest are counted. */
const CHIPS_SHOWN = 3;

export interface ServiceChooserProps {
  readonly services: PreferencesDto['services'];
  readonly chosen: readonly string[];
  readonly disabled: boolean;
  readonly onToggle: (id: string) => void;
}

/**
 * The services the employee prefers: a search, the first chosen ones as removable chips with the
 * count of the rest, and the services by category (each group says how many of it are chosen).
 */
export function ServiceChooser({ services, chosen, disabled, onToggle }: ServiceChooserProps) {
  const t = useTranslations('booking');
  const [search, setSearch] = useState('');
  const groups = serviceGroups(services, chosen, search);
  const chosenServices = chosen.flatMap((id) => services.filter((service) => service.id === id));

  if (services.length === 0) {
    return <p className="text-sm text-copy-muted">{t('employee.preferences.services.none')}</p>;
  }
  return (
    <div className="space-y-3">
      <div className="relative">
        <Label htmlFor="pref-service-search" className="sr-only">
          {t('employee.preferences.services.search')}
        </Label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-copy-muted"
        />
        <Input
          id="pref-service-search"
          type="search"
          value={search}
          className="ps-9"
          placeholder={t('employee.preferences.services.search')}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
        />
      </div>
      {chosenServices.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5">
          {chosenServices.slice(0, CHIPS_SHOWN).map((service) => (
            <li
              key={service.id}
              className="inline-flex items-center gap-1 rounded-token-sm border border-border bg-canvas py-0.5 pe-0.5 ps-2 text-sm text-copy"
            >
              {service.name}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                aria-label={t('employee.preferences.services.remove', { name: service.name })}
                onClick={() => {
                  onToggle(service.id);
                }}
              >
                <Close className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
          {chosenServices.length > CHIPS_SHOWN && (
            <li className="text-xs text-copy-muted">
              {t('employee.preferences.services.more', {
                count: chosenServices.length - CHIPS_SHOWN,
              })}
            </li>
          )}
        </ul>
      )}
      <p className="text-sm text-copy-muted" aria-live="polite">
        {t('employee.preferences.services.count', {
          chosen: chosen.length,
          total: services.length,
        })}
      </p>
      {groups.length === 0 ? (
        <p className="text-sm text-copy-muted">
          {t('employee.preferences.services.noMatch', { search })}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-token border border-border bg-surface">
          {groups.map((group) => (
            <details key={group.category ?? ''} open={search !== ''} className="group px-3">
              <summary className="flex cursor-pointer items-center justify-between gap-2 py-2.5 text-sm font-semibold text-copy">
                <span>{group.category ?? t('employee.preferences.services.noCategory')}</span>
                <span className="text-xs font-normal text-copy-muted">
                  {t('employee.preferences.services.groupCount', {
                    chosen: group.chosen,
                    total: group.total,
                  })}
                </span>
              </summary>
              <ul className="space-y-1.5 pb-3 ps-1">
                {group.services.map((service) => (
                  <li key={service.id}>
                    <CheckboxField
                      id={`pref-service-${service.id}`}
                      label={service.name}
                      checked={chosen.includes(service.id)}
                      disabled={disabled}
                      onChange={() => {
                        onToggle(service.id);
                      }}
                    />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
