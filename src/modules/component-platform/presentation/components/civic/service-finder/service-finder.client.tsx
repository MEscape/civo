'use client';

import { useState } from 'react';

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';
import { Card, CardContent } from '@components/ui/card';
import { ContentLink } from '@components/ui/content-link';
import { DynamicIcon } from '@components/ui/dynamic-icon';
import { Search } from '@components/ui/icons';
import { Input } from '@components/ui/input';

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
}

export interface ServiceFinderClientProps {
  readonly services: readonly ServiceFinderItem[];
  readonly placeholder: string;
  readonly initialCategory: string;
  readonly labels: ServiceFinderLabels;
}

function matches(service: ServiceFinderItem, query: string, category: string): boolean {
  if (category !== '' && service.category !== category) {
    return false;
  }
  if (query === '') {
    return true;
  }
  return (
    service.title.toLowerCase().includes(query) ||
    (service.description?.toLowerCase().includes(query) ?? false) ||
    (service.keywords?.some((keyword) => keyword.toLowerCase().includes(query)) ?? false)
  );
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
      size="sm"
      variant={active ? 'default' : 'ghost'}
      onClick={onSelect}
      aria-pressed={active}
      className="rounded-full"
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
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(initialCategory);

  const categories = Array.from(
    new Set(
      services
        .map((service) => service.category)
        .filter((value): value is string => value !== undefined && value !== ''),
    ),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = services.filter((service) => matches(service, normalizedQuery, category));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-copy-muted"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={placeholder}
            className="pl-9"
            aria-label={placeholder}
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
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

      {filtered.length === 0 ? (
        <p className="text-sm text-copy-muted">{labels.noResults}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {filtered.map((service) => (
            <li key={service.id}>
              <ContentLink
                href={service.href}
                className="group flex items-start gap-4 py-4 hover:bg-surface"
              >
                <Card className="flex h-10 w-10 shrink-0 items-center justify-center border-0 bg-surface">
                  <DynamicIcon
                    name={service.icon}
                    fallback={FALLBACK_ICON}
                    className="h-5 w-5 text-primary-copy"
                    aria-hidden="true"
                  />
                </Card>
                <CardContent className="flex-1 p-0">
                  <p className="text-sm font-medium text-copy group-hover:text-primary-copy">
                    {service.title}
                  </p>
                  {service.description !== undefined && (
                    <p className="mt-0.5 text-sm text-copy-muted">{service.description}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {service.department !== undefined && (
                      <Badge variant="muted">{service.department}</Badge>
                    )}
                    {service.processingNote !== undefined && (
                      <Badge>{service.processingNote}</Badge>
                    )}
                  </div>
                </CardContent>
              </ContentLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
