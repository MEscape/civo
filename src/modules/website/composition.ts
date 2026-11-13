import 'server-only';
import { cache } from 'react';

import { withAuditTrail } from '@modules/audit';
import { getAccessControl, getAuthQueries } from '@modules/auth';
import { HOME_PAGE_PATH, createSystemPage } from '@modules/builder';

import { getRateLimiter } from '@lib/rate-limit';
import { once } from '@lib/utils';

import { CreateWebsite } from './application/commands/create-website';
import { UpdateWebsite } from './application/commands/update-website';
import { UpdateWebsiteTheme } from './application/commands/update-website-theme';
import { GetPublicWebsiteBySlug } from './application/queries/get-public-website-by-slug';
import { GetWebsiteById } from './application/queries/get-website-by-id';
import { ListWebsites } from './application/queries/list-websites';
import { restoreWebsiteTheme } from './domain/models/website-theme';
import { AuthWebsiteAccess } from './infrastructure/access/auth-website-access';
import {
  LEVEL_BY_EVENT,
  TRAIL_BY_EVENT,
  loggerWebsiteAuditLog,
} from './infrastructure/audit/logger-website-audit-log';
import { PrismaWebsiteRepository } from './infrastructure/prisma/prisma-website.repository';
import { BuilderHomePageProvisioner } from './infrastructure/provisioner/builder-home-page-provisioner';

import type { WebsiteThemeView } from './application/contracts/website-views';
import type {
  ExistingWebsiteDependencies,
  WebsiteDependencies,
} from './application/website-dependencies';
import type { StoredWebsiteTheme } from './domain/models/website-theme';

/** The module's audit port: its log lines, and the trail the website's audit page reads. */
const auditLog = withAuditTrail(loggerWebsiteAuditLog, {
  source: 'website',
  levels: LEVEL_BY_EVENT,
  policy: TRAIL_BY_EVENT,
});

/**
 * The module's composition root: the one file that knows both the
 * application use cases and their infrastructure adapters. Presentation
 * and framework entry points reach use cases only through here, so they
 * never import infrastructure. `server-only` makes an accidental import
 * from a Client Component a build error. Like auth and audit, dependencies and
 * use cases are process singletons built only when first requested. The access
 * adapter delegates target authority to auth; events feed audit through its public API.
 */
const getWebsites = once(() => new PrismaWebsiteRepository());
const getDependencies = once<WebsiteDependencies>(() => ({
  websites: getWebsites(),
  authorization: getAccessControl(),
  audit: auditLog,
  rateLimiter: getRateLimiter(),
}));
const getExistingWebsiteDependencies = once<ExistingWebsiteDependencies>(() => ({
  ...getDependencies(),
  access: new AuthWebsiteAccess(getAuthQueries, getAccessControl()),
}));

/** Commands retain independent authorization and emit events only after successful writes. */
export const getWebsiteCommands = once(() => {
  const dependencies = getExistingWebsiteDependencies();
  return {
    createWebsite: new CreateWebsite({
      ...dependencies,
      homePages: new BuilderHomePageProvisioner(createSystemPage, HOME_PAGE_PATH),
    }),
    updateWebsite: new UpdateWebsite(dependencies),
    updateWebsiteTheme: new UpdateWebsiteTheme(dependencies),
  } as const;
});

/** Website-owned reads only. Auth owns accessible website names; audit owns trail reads. */
export const getWebsiteQueries = once(
  () =>
    ({
      getWebsiteById: new GetWebsiteById(getExistingWebsiteDependencies()),
      listWebsites: new ListWebsites(getExistingWebsiteDependencies()),
      getPublicWebsiteBySlug: new GetPublicWebsiteBySlug({ websites: getWebsites() }),
    }) as const,
);

/** Compatibility entry points for the website-owned query contracts. */
export const websiteQueries = {
  get getWebsiteById() {
    return getWebsiteQueries().getWebsiteById;
  },
  get listWebsites() {
    return getWebsiteQueries().listWebsites;
  },
  get getPublicWebsiteBySlug() {
    return getWebsiteQueries().getPublicWebsiteBySlug;
  },
};

/**
 * Reads a theme that the website module once validated and someone else
 * stored (a release snapshot) back into a valid theme, with the website's
 * own per-field fallbacks. The one place another module or a page learns
 * what a valid theme is, so nobody keeps a second theme reader.
 */
export function restoreStoredWebsiteTheme(
  stored: StoredWebsiteTheme | null | undefined,
): WebsiteThemeView {
  return restoreWebsiteTheme(stored);
}

/** The metadata and screen share this authorized website read within one request. */
export const loadWebsite = cache((websiteId: string) =>
  getWebsiteQueries().getWebsiteById.execute(websiteId),
);
