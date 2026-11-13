import type { AnchorHTMLAttributes } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { WebsiteSwitcher } from '@modules/website/presentation/components/website-switcher';
import messages from '@modules/website/presentation/i18n/en.json';

import { ConfirmDialog } from '@components/shared/dialog';

import { useUnsavedNavigationGuard } from '@hooks/use-unsaved-navigation-guard';

vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  usePathname: () => '/websites/alpha/settings',
  useRouter: () => ({ push: vi.fn() }),
}));

const CURRENT = { id: 'alpha', name: 'Alpha' };
const WEBSITES = [CURRENT, { id: 'beta', name: 'Beta' }];

function DirtyGuard() {
  const guard = useUnsavedNavigationGuard(true);
  return (
    <ConfirmDialog
      open={guard.isPrompting}
      title="Leave edits?"
      description="Your changes have not been saved."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      onConfirm={guard.confirm}
      onCancel={guard.cancel}
    />
  );
}

function showSwitcher(keepSection = true) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <WebsiteSwitcher current={CURRENT} websites={WEBSITES} keepSection={keepSection} offerList />
      <DirtyGuard />
    </NextIntlClientProvider>,
  );
}

describe('website navigation', () => {
  it('announces when auth supplies a truncated selector', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <WebsiteSwitcher current={CURRENT} websites={WEBSITES} keepSection offerList isTruncated />
      </NextIntlClientProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /switch website.*alpha/i }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'Only part of your website list is shown.',
    );
  });
  it('offers real links to the same section and all websites', () => {
    showSwitcher();
    fireEvent.click(screen.getByRole('button', { name: /switch website.*alpha/i }));

    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute(
      'href',
      '/websites/beta/settings',
    );
    expect(screen.getByRole('link', { name: 'All websites' })).toHaveAttribute('href', '/websites');
  });

  it('starts at the other website when the current section may not exist there', () => {
    showSwitcher(false);
    fireEvent.click(screen.getByRole('button', { name: /switch website.*alpha/i }));
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('href', '/websites/beta');
  });

  it('asks before a website link discards edits and lets the visitor stay', () => {
    showSwitcher();
    fireEvent.click(screen.getByRole('button', { name: /switch website.*alpha/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Beta' }));

    expect(screen.getByRole('alertdialog', { name: 'Leave edits?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Beta' })).toBeVisible();
  });

  it('closes its links on Escape and returns focus to the trigger', () => {
    showSwitcher();
    const trigger = screen.getByRole('button', { name: /switch website.*alpha/i });
    fireEvent.click(trigger);
    screen.getByRole('link', { name: 'Beta' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Beta' })).not.toBeInTheDocument();
  });
});
