'use client';

import { useId } from 'react';

import { DynamicIcon } from '@components/icons/dynamic-icon';
import { Search } from '@components/icons/icons';
import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { ContentLink } from '@components/ui/content-link';
import { Input, Label } from '@components/ui/input';

import { cn } from '@lib/utils';

import { useServiceFinder } from '../../../hooks/use-service-finder';

const FALLBACK_ICON = 'arrowRight' as const;

export interface ServiceFinderItem {
  readonly id: string;
  readonly title: string;
  readonly href: string;
  readonly description?: string | undefined;
  readonly keywords?: readonly string[] | undefined;
  readonly category?: string | undefined;
  readonly icon?: string | undefined;
  readonly department?: string | undefined;
  readonly processingNote?: string | undefined;
}

export interface ServiceFinderLabels {
  readonly allCategories: string;
  readonly noResults: string;
  /** The visible label of the search field. */
  readonly search: string;
  /** The accessible name of the category chips. */
  readonly categories: string;
  /** Contains the literal `{count}`, replaced here. */
  readonly resultCount: string;
}

export interface ServiceFinderClientProps {
  readonly services: readonly ServiceFinderItem[];
  readonly placeholder: string;
  readonly initialCategory: string;
  readonly labels: ServiceFinderLabels;
}

interface CategoryChipProps {
  readonly label: string;
  readonly active: boolean;
  readonly onSelect: () => void;
}

function CategoryChip({ label, active, onSelect }: CategoryChipProps) {
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'outline'}
      className={cn(
        'h-auto min-h-10 py-1.5 text-start whitespace-normal',
        !active && 'border-border-strong',
      )}
      onClick={onSelect}
      aria-pressed={active}
    >
      {label}
    </Button>
  );
}

export function ServiceFinderClient({
  services,
  placeholder,
  initialCategory,
  labels,
}: ServiceFinderClientProps) {
  const searchId = useId();
  const { query, setQuery, category, setCategory, categories, filtered } = useServiceFinder({
    services,
    initialCategory,
  });
  const status =
    filtered.length === 0
      ? labels.noResults
      : labels.resultCount.replace('{count}', String(filtered.length));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={searchId}>{labels.search}</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-copy-muted"
              aria-hidden="true"
            />
            <Input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder={placeholder}
              className="h-11 ps-9 text-base"
            />
          </div>
        </div>
        {categories.length > 0 && (
          <div role="group" aria-label={labels.categories} className="flex flex-wrap gap-2">
            <CategoryChip
              label={labels.allCategories}
              active={category === ''}
              onSelect={() => {
                setCategory('');
              }}
            />
            {categories.map((value) => (
              <CategoryChip
                key={value}
                label={value}
                active={category === value}
                onSelect={() => {
                  setCategory(value);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <p role="status" className="text-sm text-copy-muted tabular-nums">
        {status}
      </p>

      {filtered.length > 0 && (
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {filtered.map(({ service, description }) => (
            <li key={service.id}>
              <ContentLink href={service.href} className="group flex items-start gap-4 py-4">
                <DynamicIcon
                  name={service.icon}
                  fallback={FALLBACK_ICON}
                  className="mt-0.5 size-5 shrink-0 text-primary-copy"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                  <p className="text-base font-medium text-copy underline-offset-4 transition-interactive group-hover:text-primary-copy group-hover:underline">
                    {service.title}
                  </p>
                  {description !== undefined && (
                    <p className="mt-1 text-sm text-copy-muted">{description}</p>
                  )}
                  {(service.department !== undefined || service.processingNote !== undefined) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {service.department !== undefined && (
                        <Badge variant="muted">{service.department}</Badge>
                      )}
                      {service.processingNote !== undefined && (
                        <Badge>{service.processingNote}</Badge>
                      )}
                    </div>
                  )}
                </div>
              </ContentLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
