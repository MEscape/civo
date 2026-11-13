import type { ComponentProps } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NavDisclosure } from '@components/layout/nav-disclosure';

vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));

const links = [
  { href: '/first', label: 'First website', isCurrent: true },
  { href: '/second', label: 'Second website', isCurrent: false },
];

describe('NavDisclosure', () => {
  it('exposes destinations and truncation status, closes on Escape, and restores trigger focus', () => {
    render(
      <NavDisclosure
        label="Websites"
        links={links}
        isCurrent
        align="end"
        notice={<p role="status">Partial list</p>}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Websites' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.getByRole('link', { name: 'First website' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Second website' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Partial list');
    screen.getByRole('link', { name: 'Second website' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes after following a link or pressing outside', () => {
    render(<NavDisclosure label="Websites" links={links} isCurrent={false} />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('link', { name: 'First website' }));
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
});
