import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateOwnProfileAction } from '@modules/auth/presentation/actions/update-own-profile-action';
import { ProfileForm } from '@modules/auth/presentation/components/profile/profile-form.client';
import en from '@modules/auth/presentation/i18n/en.json';

vi.mock('@modules/auth/presentation/actions/update-own-profile-action', () => ({
  updateOwnProfileAction: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(updateOwnProfileAction).mockReset();
});

function show() {
  render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <ProfileForm
        profile={{
          name: 'Ada',
          email: 'ada@example.org',
          emailVerified: true,
          createdAt: new Date('2026-01-01'),
          image: null,
        }}
      />
    </NextIntlClientProvider>,
  );
}

describe('ProfileForm', () => {
  it('rejects oversized photos without creating a preview or submitting them', async () => {
    const objectUrl = vi.spyOn(URL, 'createObjectURL');
    show();
    fireEvent.change(screen.getByLabelText('Profile photo'), {
      target: { files: [new File([new Uint8Array(700_000)], 'large.png', { type: 'image/png' })] },
    });
    await screen.findByText(en.auth.validation.profileImageInvalid);
    expect(objectUrl).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    const form = screen.getByRole('button', { name: 'Save changes' }).closest('form');
    if (form === null) {
      throw new Error('Expected profile form');
    }
    fireEvent.submit(form);
    expect(await screen.findByText(en.auth.validation.profileImageInvalid)).toBeVisible();
    expect(updateOwnProfileAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    objectUrl.mockRestore();
  });
  it('saves a name without treating an untouched file input as a photo', async () => {
    vi.mocked(updateOwnProfileAction).mockResolvedValue({ ok: true, data: undefined });
    show();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Ada Lovelace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Profile saved.');
    const input = vi.mocked(updateOwnProfileAction).mock.calls[0]?.[0];
    expect(input).toBeInstanceOf(FormData);
    if (!(input instanceof FormData)) {
      throw new Error('Expected FormData');
    }
    expect(input.get('name')).toBe('Ada Lovelace');
    expect(input.has('image')).toBe(false);
    expect(screen.getByLabelText('Display name')).toHaveValue('Ada Lovelace');
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeDisabled();
  });

  it('focuses the empty name field while an absent photo remains valid', async () => {
    show();
    const name = screen.getByLabelText('Display name');
    fireEvent.change(name, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(updateOwnProfileAction).not.toHaveBeenCalled();
  });

  it('preserves edits and announces a recoverable server failure', async () => {
    vi.mocked(updateOwnProfileAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.provider_failed', message: 'Provider unavailable' },
    });
    show();
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Edited name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A service error occurred. Please try again later.',
    );
    expect(screen.getByLabelText('Display name')).toHaveValue('Edited name');
    expect(await screen.findByRole('button', { name: 'Save changes' })).toBeEnabled();
  });
});
