import type { ReactNode } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { acceptInvitationAction } from '@modules/auth/presentation/actions/accept-invitation-action';
import { useAcceptInvitationForm } from '@modules/auth/presentation/hooks/use-accept-invitation-form';
import enAuth from '@modules/auth/presentation/i18n/en.json';

vi.mock('@modules/auth/presentation/actions/accept-invitation-action', () => ({
  acceptInvitationAction: vi.fn(),
}));

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ auth: enAuth.auth }} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

describe('the shared invitation acceptance form', () => {
  beforeEach(() => vi.resetAllMocks());

  it('submits only the token for an existing account and shows accepted access', async () => {
    vi.mocked(acceptInvitationAction).mockResolvedValue({ ok: true, data: { status: 'accepted' } });
    const { result } = renderHook(() => useAcceptInvitationForm('token', true), { wrapper });
    await act(async () => {
      await result.current.form.handleSubmit(result.current.handleSubmit)();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('accepted');
    });
    expect(acceptInvitationAction).toHaveBeenCalledWith({ token: 'token' });
  });

  it('shows an already-held access distinctly from newly granted access', async () => {
    vi.mocked(acceptInvitationAction).mockResolvedValue({
      ok: true,
      data: { status: 'already_member' },
    });
    const { result } = renderHook(() => useAcceptInvitationForm('token', true), { wrapper });
    await act(async () => {
      await result.current.form.handleSubmit(result.current.handleSubmit)();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('already_member');
    });
    expect(enAuth.auth.acceptInvitation.alreadyMember).toBeTruthy();
  });

  it('keeps account setup distinct from completed membership', async () => {
    vi.mocked(acceptInvitationAction).mockResolvedValue({
      ok: true,
      data: { status: 'verify_account' },
    });
    const { result } = renderHook(() => useAcceptInvitationForm('token'), { wrapper });
    act(() => {
      result.current.form.setValue('name', 'Ada');
      result.current.form.setValue('password', 'a-long-password-1');
      result.current.form.setValue('confirmPassword', 'a-long-password-1');
    });
    await act(async () => {
      await result.current.form.handleSubmit(result.current.handleSubmit)();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('verify_account');
    });
  });

  it('shows an actionable wrong-account error and leaves acceptance available to retry', async () => {
    vi.mocked(acceptInvitationAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.invitation_account_required', message: 'Sign in' },
    });
    const { result } = renderHook(() => useAcceptInvitationForm('token', true), { wrapper });
    await act(async () => {
      await result.current.form.handleSubmit(result.current.handleSubmit)();
    });
    await waitFor(() => {
      expect(result.current.formError).toContain('invited account');
    });
    expect(result.current.status).toBeNull();
    expect(result.current.form.getValues('token')).toBe('token');
  });
});
