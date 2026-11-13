import { toWebsiteId } from '@modules/audit';
import type { AuditAccess } from '@modules/audit';

import type { AuthorizeWebsiteAccess } from '../../application/queries/authorize-website-access';
import type { ListAccessibleWebsites } from '../../application/queries/list-accessible-websites';

/**
 * Bridges audit's read port to auth's existing website permission queries.
 * This is an access adapter; audit-trail writers live separately from read authorization.
 * Resolve queries on each call so wiring never initializes authentication or captures an actor.
 */
export class AuthAuditAccess implements AuditAccess {
  constructor(
    private readonly getQueries: () => {
      readonly authorizeWebsiteAccess: Pick<AuthorizeWebsiteAccess, 'execute'>;
      readonly listAccessibleWebsites: Pick<ListAccessibleWebsites, 'execute'>;
    },
  ) {}

  authorizeWebsite(websiteId: Parameters<AuditAccess['authorizeWebsite']>[0]) {
    return this.getQueries()
      .authorizeWebsiteAccess.execute('audit.read', websiteId)
      .map(() => undefined);
  }

  listReadableWebsites() {
    return this.getQueries()
      .listAccessibleWebsites.execute('audit.read')
      .map((readable) => ({
        ...readable,
        websites: readable.websites.map(({ id, name }) => ({ id: toWebsiteId(id), name })),
      }));
  }
}
