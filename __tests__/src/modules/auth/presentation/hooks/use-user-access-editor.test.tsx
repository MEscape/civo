import React from 'react';

import { act, renderHook } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { grantPlatformAdminAction } from '@modules/auth/presentation/actions/grant-platform-admin-action';
import { removeUserAccessAction } from '@modules/auth/presentation/actions/remove-user-access-action';
import { revokePlatformAdminAction } from '@modules/auth/presentation/actions/revoke-platform-admin-action';
import { setUserAccessAction } from '@modules/auth/presentation/actions/set-user-access-action';
import { useUserAccessEditor } from '@modules/auth/presentation/hooks/use-user-access-editor';
import enAuth from '@modules/auth/presentation/i18n/en.json';

import enApp from '@i18n/messages/en.json';

vi.mock('@modules/auth/presentation/actions/grant-platform-admin-action', () => ({
  grantPlatformAdminAction: vi.fn(),
}));

vi.mock('@modules/auth/presentation/actions/revoke-platform-admin-action', () => ({
  revokePlatformAdminAction: vi.fn(),
}));

vi.mock('@modules/auth/presentation/actions/remove-user-access-action', () => ({
  removeUserAccessAction: vi.fn(),
}));

vi.mock('@modules/auth/presentation/actions/set-user-access-action', () => ({
  setUserAccessAction: vi.fn(),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={{ app: enApp, auth: enAuth.auth }} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

describe('useUserAccessEditor', () => {
  const websites = [
    { id: 'web-1', name: 'Website One' },
    { id: 'web-2', name: 'Website Two' },
    { id: 'web-3', name: 'Website Three' },
  ];

  const memberships = [{ tenantId: 'web-1', roles: ['admin' as const] }];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('manages open and close state with draft copy', () => {
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.nameOf('web-1')).toBe('Website One');
    expect(result.current.nameOf('unknown')).toBe('unknown');
    expect(result.current.addable).toEqual([
      { id: 'web-2', name: 'Website Two' },
      { id: 'web-3', name: 'Website Three' },
    ]);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('reloads current memberships when reopened after a refreshed server view', () => {
    const { result, rerender } = renderHook(
      ({ current }) => useUserAccessEditor({ userId: 'user-1', memberships: current, websites }),
      { wrapper, initialProps: { current: [{ tenantId: 'web-1', roles: ['viewer' as const] }] } },
    );
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.close();
    });
    rerender({ current: [] });
    act(() => {
      result.current.open();
    });
    expect(result.current.draft.size).toBe(0);
    expect(result.current.addable.map((website) => website.id)).toContain('web-1');
  });

  it('adds a website with default viewer role', () => {
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );

    act(() => {
      result.current.open();
    });

    act(() => {
      result.current.addWebsite('web-2');
    });

    expect(result.current.changeOf('web-2', ['viewer'])).toBe('new');
    expect(result.current.changeCount).toBe(1);
    expect(result.current.addable).toEqual([{ id: 'web-3', name: 'Website Three' }]);
  });

  it('toggles roles on an existing membership', () => {
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );

    act(() => {
      result.current.open();
    });

    expect(result.current.changeOf('web-1', ['admin'])).toBe('none');

    act(() => {
      result.current.toggleRole('web-1', 'editor', true);
    });

    expect(result.current.changeOf('web-1', ['admin', 'editor'])).toBe('changed');
    expect(result.current.changeCount).toBe(1);

    act(() => {
      result.current.toggleRole('web-1', 'editor', false);
    });

    expect(result.current.changeOf('web-1', ['admin'])).toBe('none');
    expect(result.current.changeCount).toBe(0);
  });

  it('toggles removed state for existing vs newly added websites', () => {
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );

    act(() => {
      result.current.open();
    });

    // Remove existing
    act(() => {
      result.current.toggleRemoved('web-1');
    });
    expect(result.current.changeOf('web-1', ['admin'])).toBe('removed');

    // Toggle back
    act(() => {
      result.current.toggleRemoved('web-1');
    });
    expect(result.current.changeOf('web-1', ['admin'])).toBe('none');

    // Add and then toggle remove on newly added website (should drop it completely)
    act(() => {
      result.current.addWebsite('web-2');
    });
    expect(result.current.draft.has('web-2')).toBe(true);

    act(() => {
      result.current.toggleRemoved('web-2');
    });
    expect(result.current.draft.has('web-2')).toBe(false);
  });

  it('confirm closes when nothing has changed', () => {
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );

    act(() => {
      result.current.open();
    });

    act(() => {
      result.current.confirm();
    });

    expect(result.current.isOpen).toBe(false);
    expect(setUserAccessAction).not.toHaveBeenCalled();
    expect(removeUserAccessAction).not.toHaveBeenCalled();
  });

  it('shows error if a kept website has no roles assigned upon save', () => {
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );

    act(() => {
      result.current.open();
    });

    // Remove the only role
    act(() => {
      result.current.toggleRole('web-1', 'admin', false);
    });

    act(() => {
      result.current.confirm();
    });

    expect(result.current.errorText).not.toBeNull();
    expect(result.current.isOpen).toBe(true);
    expect(setUserAccessAction).not.toHaveBeenCalled();
  });

  it('executes user access actions and closes on success', async () => {
    vi.mocked(setUserAccessAction).mockResolvedValue({ ok: true, data: undefined });
    vi.mocked(removeUserAccessAction).mockResolvedValue({ ok: true, data: undefined });

    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );

    act(() => {
      result.current.open();
    });

    act(() => {
      result.current.toggleRole('web-1', 'editor', true);
    });

    await act(async () => {
      result.current.confirm();
    });

    expect(setUserAccessAction).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 'web-1',
      roles: ['admin', 'editor'],
      expectedRoles: ['admin'],
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('displays action error code message when action fails', async () => {
    vi.mocked(setUserAccessAction).mockResolvedValue({
      ok: false,
      error: { code: 'auth.action_failed', message: 'failed' },
    });

    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );

    act(() => {
      result.current.open();
    });

    act(() => {
      result.current.toggleRole('web-1', 'editor', true);
    });

    await act(async () => {
      result.current.confirm();
    });

    expect(result.current.errorText).not.toBeNull();
    expect(result.current.isOpen).toBe(true);
  });

  it('does not replay committed grants after a later change fails', async () => {
    vi.mocked(setUserAccessAction)
      .mockResolvedValueOnce({ ok: true, data: undefined })
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'auth.permission_denied', message: 'Forbidden' },
      })
      .mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.addWebsite('web-2');
    });
    act(() => {
      result.current.addWebsite('web-3');
    });
    await act(async () => {
      result.current.confirm();
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.changeCount).toBe(1);
    expect(result.current.changeOf('web-2', ['viewer'])).toBe('none');
    expect(result.current.errorText).toContain('1 change was saved');
    await act(async () => {
      result.current.confirm();
    });
    expect(result.current.isOpen).toBe(false);
    expect(vi.mocked(setUserAccessAction).mock.calls.map(([input]) => input)).toEqual([
      { userId: 'user-1', tenantId: 'web-2', roles: ['viewer'], expectedRoles: [] },
      { userId: 'user-1', tenantId: 'web-3', roles: ['viewer'], expectedRoles: [] },
      { userId: 'user-1', tenantId: 'web-3', roles: ['viewer'], expectedRoles: [] },
    ]);
  });

  it('reports transport failures and preserves the unsaved draft', async () => {
    vi.mocked(setUserAccessAction).mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.addWebsite('web-2');
    });
    await act(async () => {
      result.current.confirm();
    });
    expect(result.current.isOpen).toBe(true);
    expect(result.current.errorText).toBe('A service error occurred. Please try again later.');
    expect(result.current.changeCount).toBe(1);
    expect(result.current.draft.get('web-2')).toEqual(['viewer']);
  });

  it('keeps an in-flight change open and refuses duplicate submission', async () => {
    let resolve: ((value: { ok: true; data: undefined }) => void) | undefined;
    vi.mocked(setUserAccessAction).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.addWebsite('web-2');
    });
    act(() => {
      result.current.confirm();
      result.current.confirm();
      result.current.close();
    });
    expect(result.current.isOpen).toBe(true);
    expect(setUserAccessAction).toHaveBeenCalledOnce();
    await act(async () => {
      resolve?.({ ok: true, data: undefined });
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('does not let a website manager change platform privileges', async () => {
    const { result } = renderHook(
      () => useUserAccessEditor({ userId: 'user-1', memberships, websites }),
      { wrapper },
    );
    act(() => {
      result.current.open();
    });
    act(() => {
      result.current.togglePlatformAdmin(true);
    });
    await act(async () => {
      result.current.confirm();
    });
    expect(result.current.platformAdmin).toBe(false);
    expect(grantPlatformAdminAction).not.toHaveBeenCalled();
    expect(revokePlatformAdminAction).not.toHaveBeenCalled();
  });

  it('toggles platform administrator role and calls grantPlatformAdminAction on confirm', async () => {
    vi.mocked(grantPlatformAdminAction).mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderHook(
      () =>
        useUserAccessEditor({
          userId: 'user-1',
          memberships,
          websites,
          isPlatformAdmin: false,
          canManagePlatform: true,
        }),
      { wrapper },
    );

    act(() => {
      result.current.open();
    });

    expect(result.current.platformAdmin).toBe(false);
    expect(result.current.changeCount).toBe(0);

    act(() => {
      result.current.togglePlatformAdmin(true);
    });

    expect(result.current.platformAdmin).toBe(true);
    expect(result.current.changeCount).toBe(1);

    await act(async () => {
      result.current.confirm();
    });

    expect(grantPlatformAdminAction).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result.current.isOpen).toBe(false);
  });

  it('calls revokePlatformAdminAction when platform administrator role is removed', async () => {
    vi.mocked(revokePlatformAdminAction).mockResolvedValue({ ok: true, data: undefined });
    const { result } = renderHook(
      () =>
        useUserAccessEditor({
          userId: 'user-1',
          memberships,
          websites,
          isPlatformAdmin: true,
          canManagePlatform: true,
        }),
      { wrapper },
    );

    act(() => {
      result.current.open();
    });

    act(() => {
      result.current.togglePlatformAdmin(false);
    });

    expect(result.current.platformAdmin).toBe(false);
    expect(result.current.changeCount).toBe(1);

    await act(async () => {
      result.current.confirm();
    });

    expect(revokePlatformAdminAction).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result.current.isOpen).toBe(false);
  });
});
