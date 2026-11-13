import type { ComponentProps, ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WEBSITE_ERROR_CODES } from '@modules/website/application/contracts/website-constraints';
import { createWebsiteAction } from '@modules/website/presentation/actions/create-website-action';
import { CreateWebsiteForm } from '@modules/website/presentation/components/create-website-form';
import { toWebsiteDto } from '@modules/website/presentation/dto/website-dto';
import en from '@modules/website/presentation/i18n/en.json';

import app from '@i18n/messages/en.json';

import { websiteView } from '../support/website-view';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@i18n', () => ({
  Link: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
  useRouter: () => navigation,
  usePathname: () => '/websites/new',
}));
vi.mock('@modules/website/presentation/actions/create-website-action', () => ({
  createWebsiteAction: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());

function Intl({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ ...en, app }} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

function fillBasics(name = 'Example Town') {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
}

describe('new website wizard', () => {
  it('derives the slug from the name until a person chooses their own and normalizes it on blur', () => {
    render(<CreateWebsiteForm step="basics" />, { wrapper: Intl });
    fillBasics();
    expect(screen.getByLabelText('Slug')).toHaveValue('example-town');
    fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'My Own Address' } });
    fireEvent.blur(screen.getByLabelText('Slug'));
    expect(screen.getByLabelText('Slug')).toHaveValue('my-own-address');
    fillBasics('Different Town');
    expect(screen.getByLabelText('Slug')).toHaveValue('my-own-address');
  });

  it('validates a step before moving on and keeps entries across steps', async () => {
    const { rerender } = render(<CreateWebsiteForm step="basics" />, { wrapper: Intl });
    fireEvent.click(screen.getByRole('button', { name: /Next:/ }));
    await waitFor(() =>
      expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true'),
    );
    expect(navigation.push).not.toHaveBeenCalled();
    fillBasics();
    fireEvent.click(screen.getByRole('button', { name: /Next:/ }));
    await waitFor(() => {
      expect(navigation.push).toHaveBeenLastCalledWith('/websites/new?step=template');
    });
    rerender(<CreateWebsiteForm step="review" />);
    expect(screen.getByText('Example Town')).toBeInTheDocument();
    expect(screen.getByText('/example-town')).toBeInTheDocument();
    expect(createWebsiteAction).not.toHaveBeenCalled();
  });

  it('creates once on review and replaces the wizard with the new website overview', async () => {
    vi.mocked(createWebsiteAction).mockResolvedValue({ ok: true, data: toWebsiteDto(websiteView) });
    const { rerender } = render(<CreateWebsiteForm step="basics" />, { wrapper: Intl });
    fillBasics();
    rerender(<CreateWebsiteForm step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create website' }));
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/websites/site-1');
    });
    expect(createWebsiteAction).toHaveBeenCalledTimes(1);
    expect(createWebsiteAction).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Example Town', slug: 'example-town' }),
    );
  });

  it('sends a slug conflict back to the basics step without navigating away', async () => {
    vi.mocked(createWebsiteAction).mockResolvedValue({
      ok: false,
      error: { code: WEBSITE_ERROR_CODES.slugTaken, message: 'Taken' },
    });
    const { rerender } = render(<CreateWebsiteForm step="basics" />, { wrapper: Intl });
    fillBasics();
    rerender(<CreateWebsiteForm step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create website' }));
    await waitFor(() => {
      expect(navigation.push).toHaveBeenLastCalledWith('/websites/new?step=basics');
    });
    rerender(<CreateWebsiteForm step="basics" />);
    expect(screen.getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true');
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('shows an operational refusal in the wizard status', async () => {
    vi.mocked(createWebsiteAction).mockResolvedValue({
      ok: false,
      error: { code: WEBSITE_ERROR_CODES.persistenceFailed, message: 'Unavailable' },
    });
    const { rerender } = render(<CreateWebsiteForm step="basics" />, { wrapper: Intl });
    fillBasics();
    rerender(<CreateWebsiteForm step="review" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create website' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
