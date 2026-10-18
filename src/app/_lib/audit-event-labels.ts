import type { AuditSource } from '@modules/audit';

import type { Locale, Namespace } from '@i18n';

import { getTranslations } from '@i18n/server';

/** The catalog of the module that records each area's events: it names them, under `auditEvents`. */
const NAMESPACE_BY_SOURCE = {
  website: 'website',
  builder: 'builder',
  release: 'release',
  booking: 'booking',
  'data-sources': 'dataSources',
  auth: 'auth',
} as const satisfies Record<AuditSource, Namespace>;

/**
 * What people call each event type, in the page's language. Each module names
 * its own events in its own catalog; a type no catalog names (an event an
 * older build recorded) is shown as it is, so a list never has a hole.
 */
export async function loadAuditEventLabels(
  locale: Locale,
  events: ReadonlyArray<{ readonly source: AuditSource; readonly type: string }>,
): Promise<Readonly<Record<string, string>>> {
  const t = await getTranslations({ locale });

  return Object.fromEntries(
    events.map(({ source, type }) => {
      // The key depends on the type, which the typed catalog cannot know in advance.
      const key = `${NAMESPACE_BY_SOURCE[source]}.auditEvents.${type}` as never;
      return [type, t.has(key) ? t(key) : type] as const;
    }),
  );
}
