import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SignInPage, { generateMetadata } from '@/app/[locale]/(auth)/sign-in/page';

import { resolveServerComponents } from '../../../../support/server-components';

const state = vi.hoisted(() => ({ enabled: true }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('@modules/auth', async () => ({
  ...(await import('@modules/auth/presentation/schemas/page-params-schema')),
  get isAuthEnabled() {
    return state.enabled;
  },
  SignInForm: ({ returnTo }: { returnTo?: string }) => <p>{returnTo ?? 'Default destination'}</p>,
}));
vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));
beforeEach(() => {
  state.enabled = true;
});
const params = Promise.resolve({ locale: 'de' });

describe('sign in route', () => {
  it('preserves a single return path for validation at the sign-in action boundary', async () => {
    render(
      await resolveServerComponents(
        SignInPage({ params, searchParams: Promise.resolve({ returnTo: '/websites/site-1' }) }),
      ),
    );
    expect(screen.getByText('/websites/site-1')).toBeInTheDocument();
  });

  it('ignores repeated return paths', async () => {
    render(
      await resolveServerComponents(
        SignInPage({ params, searchParams: Promise.resolve({ returnTo: ['/one', '/two'] }) }),
      ),
    );
    expect(screen.getByText('Default destination')).toBeInTheDocument();
  });

  it('refuses the route when authentication is disabled', () => {
    state.enabled = false;
    expect(() => SignInPage({ params, searchParams: Promise.resolve({}) })).toThrow('not-found');
  });

  it('builds metadata for the request locale', async () => {
    expect(await generateMetadata({ params, searchParams: Promise.resolve({}) })).toMatchObject({
      title: expect.any(String),
      alternates: { canonical: expect.stringContaining('/de/sign-in') },
    });
  });
});
