import 'server-only';
import { getAccessControl } from '@modules/auth';
import { HOME_PAGE_PATH, createSystemPage } from '@modules/builder';

import { CreateWebsite } from './application/commands/create-website';
import { UpdateWebsite } from './application/commands/update-website';
import { UpdateWebsiteTheme } from './application/commands/update-website-theme';
import { GetPublicWebsiteBySlug } from './application/queries/get-public-website-by-slug';
import { GetWebsiteById } from './application/queries/get-website-by-id';
import { ListWebsites } from './application/queries/list-websites';
import { restoreWebsiteTheme } from './domain/models/website-theme';
import { loggerWebsiteAuditLog } from './infrastructure/logging/logger-website-audit-log';
import { PrismaWebsiteRepository } from './infrastructure/prisma/prisma-website.repository';
import { BuilderHomePageProvisioner } from './infrastructure/provisioner/builder-home-page-provisioner';

import type { WebsiteThemeView } from './application/contracts/website-views';
import type { StoredWebsiteTheme } from './domain/models/website-theme';

/**
 * The module's composition root: the one file that knows both the
 * application use cases and their infrastructure adapters. Presentation
 * and framework entry points reach use cases only through here, so they
 * never import infrastructure. `server-only` makes an accidental import
 * from a Client Component a build error.
 */
const websites = new PrismaWebsiteRepository();
const homePages = new BuilderHomePageProvisioner(createSystemPage, HOME_PAGE_PATH);
const authorization = getAccessControl();
const dependencies = { authorization, websites, audit: loggerWebsiteAuditLog };

export const websiteCommands = {
  createWebsite: new CreateWebsite({ ...dependencies, homePages }),
  updateWebsite: new UpdateWebsite(dependencies),
  updateWebsiteTheme: new UpdateWebsiteTheme(dependencies),
} as const;

export const websiteQueries = {
  getWebsiteById: new GetWebsiteById(dependencies),
  listWebsites: new ListWebsites(dependencies),
  getPublicWebsiteBySlug: new GetPublicWebsiteBySlug({ websites }),
} as const;

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
