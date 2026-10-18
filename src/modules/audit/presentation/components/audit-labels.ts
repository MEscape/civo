import type { getTranslations } from '@i18n/server';

import type { AuditEntryView, AuditSource } from '../../application/contracts/audit-views';

type Translator = Awaited<ReturnType<typeof getTranslations<'audit'>>>;

/** The catalog key of each area's name; module names are not valid message keys. */
export const SOURCE_MESSAGE_KEYS = {
  website: 'sources.website',
  builder: 'sources.builder',
  release: 'sources.release',
  booking: 'sources.booking',
  'data-sources': 'sources.dataSources',
  auth: 'sources.auth',
} as const satisfies Record<AuditSource, `sources.${string}`>;

/**
 * Who an entry names, for people: a member by name, someone who has left as
 * a former member, and without sign-in (no accounts to name) just "member".
 */
export function actorLabel(
  t: Translator,
  entry: Pick<AuditEntryView, 'actorKind' | 'actorId'>,
  names: Readonly<Record<string, string>> | null,
): string {
  if (entry.actorKind !== 'member' || entry.actorId === null) {
    return t(entry.actorKind === 'visitor' ? 'actors.visitor' : 'actors.system');
  }
  if (names === null) {
    return t('actors.member');
  }
  return names[entry.actorId] ?? t('actors.formerMember');
}
