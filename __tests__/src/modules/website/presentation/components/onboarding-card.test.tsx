import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { OnboardingCard } from '@modules/website/presentation/components/onboarding-card';
import enWebsite from '@modules/website/presentation/i18n/en.json';

vi.mock('@i18n/server', () => ({
  getTranslations: () =>
    Promise.resolve(createTranslator({ locale: 'en', messages: enWebsite, namespace: 'website' })),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('OnboardingCard', () => {
  it('keeps completed and unavailable actions out of the way while linking unfinished work', async () => {
    render(
      await OnboardingCard({
        locale: 'en',
        steps: [
          { id: 'page', isDone: true, href: '/pages' },
          { id: 'publish', isDone: false, href: '/releases' },
          { id: 'booking', isDone: false, href: null },
        ],
      }),
    );

    expect(screen.getByRole('list', { name: 'Getting started' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '1 of 3 done' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/releases');
  });

  it('guides to the first map with its own step, linked until a map exists', async () => {
    render(
      await OnboardingCard({
        locale: 'en',
        steps: [
          { id: 'dataSource', isDone: true, href: '/data' },
          { id: 'map', isDone: false, href: '/maps/new' },
        ],
      }),
    );

    expect(screen.getByText('Configure your first map')).toBeInTheDocument();
    expect(screen.getByText(/Mark public buildings or show location data/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/maps/new');
  });

  it('disappears when setup is complete or there are no eligible steps', async () => {
    expect(await OnboardingCard({ locale: 'en', steps: [] })).toBeNull();
    expect(
      await OnboardingCard({ locale: 'en', steps: [{ id: 'page', isDone: true, href: '/pages' }] }),
    ).toBeNull();
  });
});
