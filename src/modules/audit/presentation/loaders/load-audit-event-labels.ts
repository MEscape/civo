import type { Locale } from '@i18n';

import { getMessages } from '@i18n/server';

import { isJsonRecord, unique } from '@lib/utils';

/** The namespace that words the audit events of a kind (`release.published` -> kind `release`). */
const NAMESPACE_OF_KIND: Readonly<Record<string, string>> = {
  authorization: 'auth',
  membership: 'auth',
  invitation: 'auth',
  booking: 'booking',
  page: 'builder',
  data_source: 'dataSources',
  dataset: 'dataSources',
  media: 'media',
  map: 'map',
  release: 'release',
  website: 'website',
};

/**
 * The words for the audit events a screen shows, from the `auditEvents` of the module that records
 * them. An event nobody worded is absent, and the screen shows its code instead.
 */
export async function loadAuditEventLabels(
  locale: Locale,
  entries: ReadonlyArray<{ readonly type: string }>,
): Promise<Readonly<Record<string, string>>> {
  const messages: unknown = await getMessages({ locale });
  const labels: Record<string, string> = {};
  for (const type of unique(entries.map((entry) => entry.type))) {
    const [kind = '', name = ''] = type.split('.');
    const namespace = NAMESPACE_OF_KIND[kind];
    const words =
      isJsonRecord(messages) && namespace !== undefined ? messages[namespace] : undefined;
    const events = isJsonRecord(words) ? words['auditEvents'] : undefined;
    const ofKind = isJsonRecord(events) ? events[kind] : undefined;
    const label = isJsonRecord(ofKind) ? ofKind[name] : undefined;
    if (typeof label === 'string') {
      labels[type] = label;
    }
  }
  return labels;
}
