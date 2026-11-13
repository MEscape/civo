import { render, screen } from '@testing-library/react';
import { useTranslations } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@components/providers/i18n-provider';

const { getLocale, getMessages } = vi.hoisted(() => ({
  getLocale: vi.fn(async () => 'de'),
  getMessages: vi.fn(async () => ({
    app: { loading: 'Laden' },
    auth: { signIn: { title: 'Anmelden' } },
    website: { title: 'Websites' },
  })),
}));
vi.mock('@i18n/server', () => ({
  getLocale,
  getMessages,
  getTimeZone: async () => 'Europe/Berlin',
}));

function Labels() {
  const app = useTranslations('app');
  const auth = useTranslations('auth');
  return (
    <p>
      {app('loading')} {auth('signIn.title')}
    </p>
  );
}

describe('I18nProvider', () => {
  it('keeps shell text and passes only requested module catalogs to the client boundary', async () => {
    const tree = await I18nProvider({
      locale: 'de',
      namespaces: ['auth', 'auth'],
      children: <Labels />,
    });
    expect(tree).toMatchObject({
      props: { messages: { app: { loading: 'Laden' }, auth: { signIn: { title: 'Anmelden' } } } },
    });
    render(tree);
    expect(tree).not.toHaveProperty('props.messages.website');
    expect(screen.getByText('Laden Anmelden')).toBeInTheDocument();
  });

  it('resolves a missing locale from the request and defaults to shell messages', async () => {
    const tree = await I18nProvider({ children: <p>Child</p> });
    expect(tree).toMatchObject({
      props: { locale: 'de', messages: { app: { loading: 'Laden' } } },
    });
    expect(getMessages).toHaveBeenCalledWith({ locale: 'de' });
    expect(tree).not.toHaveProperty('props.messages.auth');
  });
});
