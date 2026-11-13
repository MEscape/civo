import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

import { WebsitesPageSkeleton } from '@components/skeletons/websites-page-skeleton';

import en from '@i18n/messages/en.json';

describe('WebsitesPageSkeleton', () => {
  it('announces loading without exposing fake websites or creation controls', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{ app: en }}>
        <WebsitesPageSkeleton />
      </NextIntlClientProvider>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
