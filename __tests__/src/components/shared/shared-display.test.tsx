import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { SectionBar } from '@components/layout/layout-primitives';
import { Breadcrumbs } from '@components/shared/breadcrumbs';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { ProgressBar } from '@components/shared/progress-bar';

vi.mock('@i18n', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('ProgressBar', () => {
  it('announces a name and the value', () => {
    render(<ProgressBar value={3} max={4} label="3 of 4 steps" />);
    const bar = screen.getByRole('progressbar', { name: '3 of 4 steps' });

    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
    expect(bar.firstElementChild).toHaveStyle({ width: '75%' });
  });

  it('keeps an out-of-range value inside the range it announces', () => {
    const { rerender } = render(<ProgressBar value={9} max={4} label="over" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '100%' });

    rerender(<ProgressBar value={-2} max={4} label="under" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('is empty when there is nothing to count', () => {
    render(<ProgressBar value={1} max={0} label="none" />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '0');
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' });
  });
});

describe('Breadcrumbs', () => {
  it('links the steps up and marks the page itself', () => {
    render(
      <Breadcrumbs
        label="You are here"
        items={[
          { label: 'Websites', href: '/websites' },
          { label: 'Releases', href: '/websites/w1/releases' },
          { label: 'Preview' },
        ]}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'You are here' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Websites' })).toHaveAttribute('href', '/websites');
    expect(screen.getByText('Preview')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: 'Preview' })).not.toBeInTheDocument();
  });

  it('renders steps that share a label', () => {
    render(<Breadcrumbs label="Path" items={[{ label: 'Page', href: '/a' }, { label: 'Page' }]} />);

    expect(screen.getAllByText('Page')).toHaveLength(2);
  });
});

describe('PageSkeleton', () => {
  it('is one busy region that announces loading once and hides the blocks', () => {
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={{ app: { loading: 'Loading' } }}>
        <PageSkeleton />
      </NextIntlClientProvider>,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Loading');
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    for (const block of container.querySelectorAll('.animate-pulse')) {
      expect(block).toHaveAttribute('aria-hidden', 'true');
    }
  });
});

describe('SectionBar', () => {
  it('takes the token height, so a fallback and its content share one size', () => {
    render(<SectionBar data-testid="bar">content</SectionBar>);

    expect(screen.getByTestId('bar')).toHaveClass('h-website-bar', 'sticky', 'shrink-0');
  });
});
