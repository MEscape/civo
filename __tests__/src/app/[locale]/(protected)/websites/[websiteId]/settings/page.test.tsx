import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import SettingsPage, {
  generateMetadata,
} from '@/app/[locale]/(protected)/websites/[websiteId]/settings/page';

import { resolveServerComponents } from '../../../../../../support/server-components';

const state = vi.hoisted(() => ({ general: false, theme: false }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('@/app/_lib/website-access', () => ({
  getWebsiteAccess: async () => ({
    may: (permission: string) => (permission === 'website.update' ? state.general : state.theme),
  }),
}));
vi.mock('@modules/website', () => ({
  WebsiteSettings: ({
    websiteId,
    canEditGeneral,
    canEditTheme,
  }: {
    websiteId: string;
    canEditGeneral: boolean;
    canEditTheme: boolean;
  }) => (
    <p>
      {websiteId} general={String(canEditGeneral)} theme={String(canEditTheme)}
    </p>
  ),
}));
vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));
const props = { params: Promise.resolve({ locale: 'en', websiteId: 'site-2' }) };

describe('website settings route', () => {
  it.each([
    { general: true, theme: false },
    { general: false, theme: true },
    { general: true, theme: true },
  ])('preserves separate edit capabilities: %j', async (permissions) => {
    Object.assign(state, permissions);
    render(await resolveServerComponents(SettingsPage(props)));
    expect(
      screen.getByText(`site-2 general=${permissions.general} theme=${permissions.theme}`),
    ).toBeInTheDocument();
  });

  it('refuses a page whose controls are all unavailable', async () => {
    Object.assign(state, { general: false, theme: false });
    await expect(resolveServerComponents(SettingsPage(props))).rejects.toThrow('not-found');
  });

  it('keeps settings metadata private', async () => {
    expect(await generateMetadata(props)).toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});
