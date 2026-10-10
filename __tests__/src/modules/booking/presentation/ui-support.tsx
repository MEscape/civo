import type { ReactElement } from 'react';

import { act, fireEvent, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import deBooking from '@modules/booking/presentation/i18n/de.json';
import enBooking from '@modules/booking/presentation/i18n/en.json';

/**
 * The few gestures the booking screens need, on top of `fireEvent`: the test
 * suite has no user-event dependency, and these are enough because the
 * components only use click and change handlers.
 */
export interface User {
  click(element: HTMLElement): Promise<void>;
  type(element: HTMLElement, text: string): Promise<void>;
  clear(element: HTMLElement): Promise<void>;
}

export function setup(): User {
  const flush = () =>
    act(async () => {
      await Promise.resolve();
    });
  const valueOf = (element: HTMLElement) => (element as HTMLInputElement).value;
  return {
    async click(element) {
      fireEvent.click(element);
      await flush();
    },
    async type(element, text) {
      fireEvent.change(element, { target: { value: valueOf(element) + text } });
      await flush();
    },
    async clear(element) {
      fireEvent.change(element, { target: { value: '' } });
      await flush();
    },
  };
}

export function renderBooking(ui: ReactElement, locale: 'en' | 'de' = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? enBooking : deBooking}
      timeZone="UTC"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}

export function failure(code: string, fieldErrors?: Record<string, string[]>) {
  return {
    ok: false as const,
    error: { code, message: code, ...(fieldErrors === undefined ? {} : { fieldErrors }) },
  };
}
