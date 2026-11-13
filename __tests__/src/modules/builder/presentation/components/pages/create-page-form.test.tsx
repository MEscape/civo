import type { ComponentProps, ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BUILDER_ERROR_CODES } from '@modules/builder/application/contracts/builder-constraints';
import { createPageAction } from '@modules/builder/presentation/actions/create-page-action';
import { CreatePageForm } from '@modules/builder/presentation/components/pages/create-page-form.client';
import en from '@modules/builder/presentation/i18n/en.json';

import app from '@i18n/messages/en.json';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
  useRouter: () => navigation,
  usePathname: () => '/websites/site-1/builder/new',
}));
vi.mock('@modules/builder/presentation/actions/create-page-action', () => ({
  createPageAction: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

function Intl({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ ...en, app }} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

const title = () => screen.getByRole('textbox', { name: 'Title' });
const path = () => screen.getByRole('textbox', { name: 'Path' });

describe('new page wizard', () => {
  it('derives the path from the title and moves to the review only with valid entries', async () => {
    const { rerender } = render(<CreatePageForm websiteId="site-1" step="page" />, {
      wrapper: Intl,
    });
    fireEvent.click(screen.getByRole('button', { name: /Next:/ }));
    await waitFor(() => expect(title()).toHaveAttribute('aria-invalid', 'true'));
    expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.change(title(), { target: { value: 'About us' } });
    expect(path()).toHaveValue('about-us');
    fireEvent.click(screen.getByRole('button', { name: /Next:/ }));
    await waitFor(() => {
      expect(navigation.push).toHaveBeenLastCalledWith('/websites/site-1/builder/new?step=review');
    });
    rerender(<CreatePageForm websiteId="site-1" step="review" />);
    expect(screen.getByText('About us')).toBeInTheDocument();
    expect(screen.getByText('/about-us')).toBeInTheDocument();
  });

  it('creates once on review and replaces the wizard with the editor of the new page', async () => {
    vi.mocked(createPageAction).mockResolvedValue({
      ok: true,
      data: { id: 'page-9', websiteId: 'site-1' },
    } as Awaited<ReturnType<typeof createPageAction>>);
    const { rerender } = render(<CreatePageForm websiteId="site-1" step="page" />, {
      wrapper: Intl,
    });
    fireEvent.change(title(), { target: { value: 'About us' } });
    rerender(<CreatePageForm websiteId="site-1" step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/websites/site-1/builder/page-9');
    });
    expect(createPageAction).toHaveBeenCalledTimes(1);
    expect(createPageAction).toHaveBeenCalledWith({
      websiteId: 'site-1',
      title: 'About us',
      path: 'about-us',
    });
  });

  it('sends a taken path back to its step and field', async () => {
    vi.mocked(createPageAction).mockResolvedValue({
      ok: false,
      error: { code: BUILDER_ERROR_CODES.pagePathTaken, message: 'Taken' },
    });
    const { rerender } = render(<CreatePageForm websiteId="site-1" step="page" />, {
      wrapper: Intl,
    });
    fireEvent.change(title(), { target: { value: 'About us' } });
    rerender(<CreatePageForm websiteId="site-1" step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create page' }));
    await waitFor(() => {
      expect(navigation.push).toHaveBeenLastCalledWith('/websites/site-1/builder/new?step=page');
    });
    rerender(<CreatePageForm websiteId="site-1" step="page" />);
    expect(path()).toHaveAttribute('aria-invalid', 'true');
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
