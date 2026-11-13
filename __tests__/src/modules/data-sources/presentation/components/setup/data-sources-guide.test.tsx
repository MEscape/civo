import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { DataSourcesGuide } from '@modules/data-sources/presentation/components/setup/data-sources-guide';
import enDataSources from '@modules/data-sources/presentation/i18n/en.json';

describe('DataSourcesGuide', () => {
  it('keeps domain-specific steps and progress in the shared checklist', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enDataSources}>
        <DataSourcesGuide
          steps={[
            { id: 'source', isDone: true },
            { id: 'dataset', isDone: false },
            { id: 'mapping', isDone: false },
            { id: 'use', isDone: false },
          ]}
        />
      </NextIntlClientProvider>,
    );

    const steps = within(
      screen.getByRole('list', { name: 'How real data gets onto your pages' }),
    ).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps[0]).toHaveTextContent('Connect a sourcedone');
    expect(steps[1]).toHaveTextContent('Add a dataset');
    expect(screen.getByRole('progressbar', { name: '1 of 4 done' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('offers one button, on the step to do now', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enDataSources}>
        <DataSourcesGuide
          steps={[
            { id: 'source', isDone: true },
            { id: 'dataset', isDone: true },
            { id: 'mapping', isDone: false, href: '/websites/w/data/s/datasets/d/mapping' },
            { id: 'use', isDone: false },
          ]}
        />
      </NextIntlClientProvider>,
    );

    // The shared Link puts the language in front of the address.
    expect(screen.getByRole('link', { name: 'Map fields' })).toHaveAttribute(
      'href',
      expect.stringContaining('/websites/w/data/s/datasets/d/mapping'),
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
