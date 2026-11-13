import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { WebsiteAboutCard } from '@modules/website/presentation/components/website-about-card';
import en from '@modules/website/presentation/i18n/en.json';

import { createAppFormatters } from '@i18n/formatters/app-formatters';

import { websiteView } from '../support/website-view';

vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
vi.mock('@i18n/server', () => ({
  getTranslations: async () =>
    createTranslator({ locale: 'en', messages: en, namespace: 'website' }),
  getAppFormatters: async () => createAppFormatters('en', 'UTC'),
}));

describe('WebsiteAboutCard', () => {
  it('does not offer publication, clipboard, or counts the caller cannot expose', async () => {
    render(
      await WebsiteAboutCard({
        locale: 'en',
        website: websiteView,
        publicHref: null,
        publicUrl: null,
        pageCount: null,
        dataSourceCount: null,
      }),
    );
    expect(screen.getByText('/example-town')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Pages')).not.toBeInTheDocument();
  });

  it('links safely to the public site and includes authorized zero counts', async () => {
    render(
      await WebsiteAboutCard({
        locale: 'en',
        website: websiteView,
        publicHref: '/example-town',
        publicUrl: 'https://example.org/example-town',
        pageCount: 0,
        dataSourceCount: 3,
      }),
    );
    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
