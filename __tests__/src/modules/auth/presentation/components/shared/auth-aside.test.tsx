import { render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { AuthAside } from '@modules/auth/presentation/components/shared/auth-aside';
import en from '@modules/auth/presentation/i18n/en.json';

vi.mock('@i18n/server', () => ({
  getTranslations: async () => createTranslator({ locale: 'en', messages: en, namespace: 'auth' }),
}));

describe('AuthAside', () => {
  it('renders translated product guidance and an accessible company mark without exposing decoration as content', async () => {
    render(await AuthAside({ locale: 'en' }));
    expect(screen.getByText(en.auth.shell.headline)).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(en.auth.shell.features.builder.title)).toBeInTheDocument();
    expect(screen.getByText(en.auth.shell.features.booking.title)).toBeInTheDocument();
    expect(screen.getByText(en.auth.shell.features.releases.title)).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});
