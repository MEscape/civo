import { orNotFound } from '@lib/errors/or-not-found';

import type { WebsiteSettingsReaders } from '../../application/contracts/website-views';

/** Normalizes stored values for the edit forms after the query independently authorizes the target website. */
export async function loadWebsiteSettings(websiteId: string, queries: WebsiteSettingsReaders) {
  const website = await orNotFound(queries.getWebsiteById.execute(websiteId));
  return { website, initialValues: { name: website.name, description: website.description ?? '' } };
}
