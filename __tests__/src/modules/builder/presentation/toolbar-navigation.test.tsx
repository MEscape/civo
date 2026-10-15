import type { ReactNode } from 'react';

import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { BuilderToolbar } from '@modules/builder/presentation/components/toolbar/builder-toolbar';
import enBuilder from '@modules/builder/presentation/i18n/en.json';
import type { EditorLinks } from '@modules/builder/presentation/navigation/editor-links';

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@modules/builder/presentation/components/toolbar/toolbar-history-controls', () => ({
  ToolbarHistoryControls: () => null,
}));
vi.mock('@modules/builder/presentation/components/toolbar/toolbar-viewport-controls', () => ({
  ToolbarViewportControls: () => null,
}));
vi.mock('@modules/builder/presentation/components/toolbar/toolbar-mode-links', () => ({
  ToolbarModeLinks: () => null,
}));
vi.mock('@modules/builder/presentation/components/toolbar/save-controls', () => ({
  SaveControls: () => null,
}));

const LINKS: EditorLinks = { pages: '/websites/w1/builder', publicSite: '/s/town' };

describe('builder toolbar', () => {
  it('names the page list and the page, leaving the website and its sections to the bar above', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enBuilder} timeZone="UTC">
        <BuilderToolbar pageTitle="Home" links={LINKS} />
      </NextIntlClientProvider>,
    );

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Pages' })).toHaveAttribute(
      'href',
      '/websites/w1/builder',
    );
    expect(within(breadcrumb).getByText('Home')).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
  });
});
