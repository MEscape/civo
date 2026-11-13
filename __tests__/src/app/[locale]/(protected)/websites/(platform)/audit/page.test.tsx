import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AuditPage, {
  generateMetadata,
} from '@/app/[locale]/(protected)/websites/(platform)/audit/page';

import { resolveServerComponents } from '../../../../../../support/server-components';

vi.mock('@modules/website', async () => import('@modules/website/presentation/routes'));
vi.mock('@modules/audit', () => ({
  AuditAdministration: ({
    locale,
    pathname,
    scope,
    searchParams,
  }: {
    locale: string;
    pathname: string;
    scope: { kind: string; websiteAuditHref: (id: string) => string };
    searchParams: Record<string, string>;
  }) => (
    <p>
      {locale} {pathname} {scope.kind} {scope.websiteAuditHref('site-1')} {searchParams['type']}
    </p>
  ),
}));
vi.mock('@i18n/server', () => ({ getTranslations: async () => (key: string) => key }));
const props = {
  params: Promise.resolve({ locale: 'en' }),
  searchParams: Promise.resolve({ type: 'website.updated' }),
};

describe('global audit route', () => {
  it('delegates authorized reach to the audit screen and preserves filter parameters', async () => {
    render(await resolveServerComponents(AuditPage(props)));
    expect(
      screen.getByText('en /websites/audit global /websites/site-1/audit website.updated'),
    ).toBeInTheDocument();
  });

  it('keeps audit metadata private', async () => {
    expect(await generateMetadata(props)).toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});
