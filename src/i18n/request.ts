import { IntlErrorCode, type IntlError } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { serverEnv } from '@lib/config';
import { logger } from '@lib/logger';
import { deepMerge } from '@lib/utils';

import {
  I18N_CONFIG,
  type Locale,
  parseLocale,
  type MessageCatalog,
  getMessageFallback,
} from './config';
import { I18N_ERROR_CODES } from './errors';

const IS_PRODUCTION = serverEnv.NODE_ENV === 'production';

async function loadRequestMessages(locale: Locale): Promise<MessageCatalog> {
  try {
    // A template-literal import cannot be typed by TypeScript; every locale file default-exports the catalog.
    const { default: messages } = (await import(`./locales/${locale}.ts`)) as {
      default: MessageCatalog;
    };

    const { defaultLocale } = I18N_CONFIG;
    if (!IS_PRODUCTION || locale === defaultLocale) {
      return messages;
    }

    const { default: defaultMessages } = (await import(`./locales/${defaultLocale}.ts`)) as {
      default: MessageCatalog;
    };
    return deepMerge(defaultMessages, messages);
  } catch (error) {
    throw new Error(`Failed to load messages for locale "${locale}"`, { cause: error });
  }
}

function handleIntlError(error: IntlError): void {
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    logger.warn('Missing translation', {
      module: 'i18n',
      code: I18N_ERROR_CODES.missingMessage,
      detail: error.message,
    });
    return;
  }

  if (error.code === IntlErrorCode.INVALID_KEY) {
    logger.warn('Invalid translation key', {
      module: 'i18n',
      code: I18N_ERROR_CODES.invalidMessageKey,
      detail: error.message,
    });
    return;
  }

  logger.error('Translation runtime error', error, { module: 'i18n', code: error.code });
}

export default getRequestConfig(
  async (
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- requestLocale is deprecated in favor of next/root-params; migrate together with the Next.js upgrade
    { requestLocale },
  ) => {
    const locale = parseLocale(await requestLocale).unwrapOr(I18N_CONFIG.defaultLocale);

    return {
      locale,
      messages: await loadRequestMessages(locale),
      timeZone: I18N_CONFIG.defaultTimeZone,
      onError: handleIntlError,
      getMessageFallback: (args) => getMessageFallback(args, !IS_PRODUCTION),
    };
  },
);
