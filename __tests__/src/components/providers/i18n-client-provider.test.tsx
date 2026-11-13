import { render, screen } from '@testing-library/react';
import { useTranslations } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nClientProvider } from '@components/providers/i18n-client-provider';

function MissingLabel() {
  const t = useTranslations('app');
  return <p>{t('routeError.title')}</p>;
}

afterEach(() => vi.restoreAllMocks());

describe('I18nClientProvider', () => {
  it.each([true, false])('handles missing messages with development=%s', (isDevelopment) => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <I18nClientProvider
        locale="en"
        timeZone="UTC"
        messages={{ app: {} }}
        isDevelopment={isDevelopment}
      >
        <MissingLabel />
      </I18nClientProvider>,
    );
    expect(
      screen.getByText(isDevelopment ? '⚠ app.routeError.title' : 'app.routeError.title'),
    ).toBeInTheDocument();
    expect(warning).toHaveBeenCalledTimes(isDevelopment ? 1 : 0);
  });
});
