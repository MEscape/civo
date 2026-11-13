import { I18nProvider } from '@components/providers/i18n-provider';

import type { Locale } from '@i18n';

import { getAuditQueries } from '../../composition';
import { loadAuditAdministration } from '../loaders/load-audit-administration';

import { AuditLog } from './audit-log';

import type { AuditScope, ResolveAuditSubjects } from '../loaders/load-audit-administration';

export interface AuditAdministrationProps {
  readonly locale: Locale;
  readonly pathname: string;
  readonly scope: AuditScope;
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  /** Names what the entries refer to; the route supplies it because audit may not reach those modules. */
  readonly resolveSubjects?: ResolveAuditSubjects | undefined;
}

/**
 * Top-level Server Component for the audit log in both website-specific and platform scopes.
 * Encapsulates data fetching, search parameter parsing, and view resolution so route pages
 * stay clean and declarative.
 */
export async function AuditAdministration({
  locale,
  pathname,
  scope,
  searchParams,
  resolveSubjects,
}: AuditAdministrationProps) {
  const view = await loadAuditAdministration({
    locale,
    pathname,
    scope,
    searchParams,
    queries: getAuditQueries(),
    resolveSubjects,
  });

  return (
    <I18nProvider locale={locale} namespaces={['audit']}>
      <AuditLog
        locale={locale}
        pathname={pathname}
        filter={view.filter}
        trail={view.trail}
        eventLabels={view.eventLabels}
        names={view.names}
        subjects={view.subjects}
        websites={view.websites}
        websiteAuditHref={view.websiteAuditHref}
      />
    </I18nProvider>
  );
}
