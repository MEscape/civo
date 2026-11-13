import type { ReactNode } from 'react';

import { act, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requestPasswordResetAction } from '@modules/auth/presentation/actions/request-password-reset-action';
import { useForgotPasswordForm } from '@modules/auth/presentation/hooks/use-forgot-password-form';
import en from '@modules/auth/presentation/i18n/en.json';

vi.mock('@modules/auth/presentation/actions/request-password-reset-action', () => ({
  requestPasswordResetAction: vi.fn(),
}));
beforeEach(() => vi.mocked(requestPasswordResetAction).mockReset());
function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

describe('useForgotPasswordForm', () => {
  it('shows only the submitted address after success and lets the person return to the form', async () => {
    vi.mocked(requestPasswordResetAction).mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderHook(useForgotPasswordForm, { wrapper });
    await act(async () => {
      result.current.handleSubmit({ email: ' person@example.org ' });
    });
    expect(result.current.sentTo).toBe('person@example.org');
    await act(async () => {
      result.current.clearSentTo();
    });
    expect(result.current.sentTo).toBeNull();
  });

  it('keeps failures visible without claiming that a message was sent', async () => {
    vi.mocked(requestPasswordResetAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.rate_limited', message: 'Wait', retryAfterSeconds: 30 },
    });
    const { result } = renderHook(useForgotPasswordForm, { wrapper });
    await act(async () => {
      result.current.handleSubmit({ email: 'person@example.org' });
    });
    expect(result.current.sentTo).toBeNull();
    expect(result.current.formError).toBeTruthy();
    expect(result.current.errorText(undefined)).toBeUndefined();
    expect(result.current.errorText('unknown.code')).toBeTruthy();
  });
});
