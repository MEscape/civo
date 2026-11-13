'use client';

import { useMemo, useState } from 'react';

import { isDefined, stripHtml, unique } from '@lib/utils';

import type {
  ServiceFinderItem,
  ServiceFinderClientProps,
} from '../components/civic/service-finder/service-finder.client';

interface IndexedService {
  readonly service: ServiceFinderItem;
  /** The description as plain text, computed once. */
  readonly description: string | undefined;
  /** Everything a query can match, lower-cased, computed once. */
  readonly haystack: string;
}

function indexServices(services: readonly ServiceFinderItem[]): readonly IndexedService[] {
  return services.map((service) => {
    const description =
      service.description === undefined ? undefined : stripHtml(service.description);
    const haystack = [service.title, description, ...(service.keywords ?? [])]
      .filter(isDefined)
      .join('\n')
      .toLowerCase();
    return { service, description, haystack };
  });
}

function matches(entry: IndexedService, query: string, category: string): boolean {
  if (category !== '' && entry.service.category !== category) {
    return false;
  }
  return query === '' || entry.haystack.includes(query);
}

export function useServiceFinder({
  services,
  initialCategory,
}: Pick<ServiceFinderClientProps, 'services' | 'initialCategory'>) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(initialCategory);

  const indexed = useMemo(() => indexServices(services), [services]);
  const categories = unique(
    services
      .map((service) => service.category)
      .filter((value): value is string => isDefined(value) && value !== ''),
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = indexed.filter((entry) => matches(entry, normalizedQuery, category));
  return { query, setQuery, category, setCategory, categories, filtered };
}
