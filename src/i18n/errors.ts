export const I18N_ERROR_CODES = {
  messagesLoadFailed: 'i18n.messagesLoadFailed',
  missingMessage: 'i18n.missingMessage',
  invalidMessageKey: 'i18n.invalidMessageKey',
  unsupportedLocale: 'i18n.unsupportedLocale',
} as const satisfies Record<string, string>;

export function resolveMessageByCode(code: string): string {
  return `errors.${code}`;
}
