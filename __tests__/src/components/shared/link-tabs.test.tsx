import type { ComponentProps } from 'react';

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LinkTabs } from '@components/shared/filter-bar';
import { TABS_TRIGGER_CLASS_NAME } from '@components/ui/tabs-styles';

vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

describe('LinkTabs', () => {
  const tabs = [
    { key: 'releases', label: 'Releases', href: '/releases' },
    { key: 'updates', label: 'Updates', href: '/updates' },
  ];

  it('names the navigation and marks only the active destination as current', () => {
    render(<LinkTabs label="Release sections" activeKey="updates" tabs={tabs} />);

    expect(screen.getByRole('navigation', { name: 'Release sections' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Updates' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Releases' })).not.toHaveAttribute('aria-current');
  });

  it('keeps every destination a plain link and styles it like a tab', () => {
    render(<LinkTabs label="Release sections" activeKey="releases" tabs={tabs} />);

    const link = screen.getByRole('link', { name: 'Releases' });
    expect(link).toHaveAttribute('href', '/releases');
    expect(link).toHaveClass(...TABS_TRIGGER_CLASS_NAME.split(' ').slice(0, 2));
  });
});
