import type { ComponentProps } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppNav } from '@components/layout/app-nav';

const state = vi.hoisted(() => ({ pathname: '/pages/home', suspend: false }));
const unresolved = new Promise<never>(() => {});
vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
  usePathname: () => {
    if (state.suspend) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Suspense signals a pending path by throwing its promise.
      throw unresolved;
    }
    return state.pathname;
  },
}));
beforeEach(() => {
  state.pathname = '/pages/home';
  state.suspend = false;
});

describe('AppNav', () => {
  it('marks the current header destination while preserving brand and unrelated links', () => {
    render(
      <AppNav
        label="Main navigation"
        variant="header"
        links={[
          { href: '/pages', label: 'Brand', isBrand: true },
          { href: '/pages', label: 'Pages' },
          { href: '/users', label: 'Users' },
        ]}
      />,
    );
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Pages' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Brand' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Users' })).not.toHaveAttribute('aria-current');
  });

  it('renders unmarked links while the runtime path is suspended', () => {
    state.suspend = true;
    render(
      <AppNav
        label="Main navigation"
        variant="header"
        links={[{ href: '/pages', label: 'Pages' }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Pages' })).not.toHaveAttribute('aria-current');
  });

  it('keeps section destinations in the compact disclosure before measurement and marks the active one', () => {
    state.pathname = '/users';
    render(
      <AppNav
        label="Website sections"
        moreLabel="More"
        variant="section"
        links={[
          { href: '/', label: 'Town', isBrand: true },
          { href: '/pages', label: 'Pages' },
          { href: '/users', label: 'Users', group: 'Administration' },
          { href: '/audit', label: 'Audit', group: 'Administration' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Town' })).not.toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('button', { name: 'Users' }));
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Audit' })).not.toHaveAttribute('aria-current');
  });
});
