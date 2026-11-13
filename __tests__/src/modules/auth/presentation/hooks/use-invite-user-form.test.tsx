import type { ReactNode, SyntheticEvent } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { inviteUserAction } from '@modules/auth/presentation/actions/invite-user-action';
import { useInviteUserForm } from '@modules/auth/presentation/hooks/use-invite-user-form';
import type { InviteUserFormOptions } from '@modules/auth/presentation/hooks/use-invite-user-form';
import enAuth from '@modules/auth/presentation/i18n/en.json';
import { PLATFORM_TARGET } from '@modules/auth/presentation/schemas/invite-user-form-schema';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('@i18n', () => ({
  useRouter: () => navigation,
  usePathname: () => '/websites/users/invite',
}));
vi.mock('@modules/auth/presentation/actions/invite-user-action', () => ({
  inviteUserAction: vi.fn(),
}));

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ auth: enAuth.auth }} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

const websites = [{ id: 'website-1', name: 'Website One' }];
const submitEvent = { preventDefault: () => undefined } as SyntheticEvent<HTMLFormElement>;

function renderReview(options: Partial<InviteUserFormOptions>, values: Record<string, string>) {
  const rendered = renderHook(
    () =>
      useInviteUserForm({
        step: 'review',
        listHref: '/websites/users',
        initialRole: 'viewer',
        ...options,
      }),
    { wrapper },
  );
  act(() => {
    for (const [name, value] of Object.entries(values)) {
      rendered.result.current.form.setValue(name as 'email', value);
    }
  });
  return rendered;
}

async function submit(result: { current: ReturnType<typeof useInviteUserForm> }) {
  await act(async () => {
    result.current.onSubmit(submitEvent);
    await Promise.resolve();
  });
}

describe('useInviteUserForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends a website invitation, clears the form and returns to the list with a notice', async () => {
    vi.mocked(inviteUserAction).mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderReview(
      {
        initialRole: 'editor',
        initialTenantId: 'website-1',
        listHref: '/websites/website-1/users',
      },
      { email: 'ada@example.org' },
    );
    await submit(result);
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/websites/website-1/users?invited=1');
    });
    expect(inviteUserAction).toHaveBeenCalledWith({
      scope: 'website',
      email: 'ada@example.org',
      role: 'editor',
      tenantId: 'website-1',
    });
    expect(result.current.form.getValues('email')).toBe('');
  });

  it('sends a platform invitation only when the person may invite platform administrators', async () => {
    vi.mocked(inviteUserAction).mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderReview(
      { websites, canInvitePlatformAdmin: true },
      { email: 'ada@example.org', tenantId: PLATFORM_TARGET },
    );
    await submit(result);
    await waitFor(() => {
      expect(inviteUserAction).toHaveBeenCalledWith({
        scope: 'platform',
        email: 'ada@example.org',
      });
    });
  });

  it('rejects a forged platform target for a manager and sends them back to the access step', async () => {
    const { result } = renderReview(
      { websites },
      { email: 'ada@example.org', tenantId: PLATFORM_TARGET },
    );
    expect(result.current.targetOptions.map((option) => option.value)).toEqual(['website-1']);
    await submit(result);
    expect(inviteUserAction).not.toHaveBeenCalled();
    expect(result.current.form.getFieldState('tenantId').error?.message).toBe(
      'auth.validation.tenant_invalid',
    );
    expect(navigation.push).toHaveBeenCalledWith('/websites/users/invite?step=access');
  });

  it('sends a person who skipped to the review back to the step that misses an entry', async () => {
    const { result } = renderReview({ websites }, { tenantId: 'website-1' });
    await submit(result);
    await waitFor(() => {
      expect(navigation.push).toHaveBeenCalledWith('/websites/users/invite?step=person');
    });
    expect(inviteUserAction).not.toHaveBeenCalled();
  });

  it('keeps every entry and places a server field error on its step', async () => {
    vi.mocked(inviteUserAction).mockResolvedValue({
      ok: false,
      error: {
        code: 'auth.validation_failed',
        message: 'Invalid input',
        fieldErrors: { email: ['auth.validation.email_invalid'] },
      },
    });
    const { result } = renderReview({ initialTenantId: 'website-1' }, { email: 'ada@example.org' });
    await submit(result);
    await waitFor(() => {
      expect(result.current.form.getFieldState('email').error?.message).toBe(
        'auth.validation.email_invalid',
      );
    });
    expect(result.current.form.getValues('email')).toBe('ada@example.org');
    expect(navigation.push).toHaveBeenCalledWith('/websites/users/invite?step=person');
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
