import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AuditPage, {
  generateMetadata,
} from '@/app/[locale]/(protected)/websites/[websiteId]/audit/page';

import { resolveServerComponents } from '../../../../../../support/server-components';

vi.mock('@modules/website', async () => import('@modules/website/presentation/routes'));
const resolver = vi.hoisted(() => vi.fn());
vi.mock('@/app/_lib/audit-subjects', () => ({ auditSubjectResolver: () => resolver }));
vi.mock('@/app/_lib/website-access', () => ({
  getWebsiteAccess: async () => ({ may: () => true }),
}));
vi.mock('@modules/audit', () => ({
  AuditAdministration: ({
    pathname,
    scope,
    resolveSubjects,
  }: {
    pathname: string;
    scope: { kind: string; websiteId: string };
    resolveSubjects: unknown;
  }) => (
    <p>
      {pathname} {scope.kind} {scope.websiteId} {resolveSubjects === resolver ? 'names' : 'bare'}
    </p>
  ),
}));
vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));
const props = {
  params: Promise.resolve({ locale: 'en', websiteId: 'site-2' }),
  searchParams: Promise.resolve({}),
};

describe('website audit route', () => {
  it('passes the explicit URL website, and the lookup of what its entries name, to the audit screen', async () => {
    render(await resolveServerComponents(AuditPage(props)));
    expect(screen.getByText('/websites/site-2/audit website site-2 names')).toBeInTheDocument();
  });

  it('keeps website audit metadata private', async () => {
    expect(await generateMetadata(props)).toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});
