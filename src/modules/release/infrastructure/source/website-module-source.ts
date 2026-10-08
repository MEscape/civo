import type { WebsiteView } from '@modules/website';

import type { AppError } from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { toWebsiteId } from '../../domain/models/ids';

import type { WebsiteId } from '../../domain/models/ids';
import type { PublishableWebsite } from '../../domain/models/publishable';
import type { WebsiteSource, WebsiteSourceError } from '../../domain/ports/website-source.port';

/**
 * The release module's ONLY dependency on the website module's data,
 * through its public API. The website module authorizes the actor and
 * enforces tenant isolation; this adapter only translates its answer.
 * Everything a release pins about a website arrives here, so release never
 * rebuilds it from anywhere else.
 */
export class WebsiteModuleSource implements WebsiteSource {
  constructor(private readonly getWebsiteById: (id: string) => AppResultAsync<WebsiteView>) {}

  /** An unknown website and a malformed id are both just "absent" to the migration module. */
  private isAbsent(error: AppError): boolean {
    return error.kind === 'not_found' || error.kind === 'validation';
  }

  findById(id: WebsiteId): AppResultAsync<PublishableWebsite | null, WebsiteSourceError> {
    return this.getWebsiteById(id)
      .map((view): PublishableWebsite => ({
        id: toWebsiteId(view.id),
        name: view.name,
        slug: view.slug,
        description: view.description,
        theme: {
          colors: { ...view.theme.colors },
          typography: { ...view.theme.typography },
          radius: view.theme.radius,
          spacingScale: view.theme.spacingScale,
        },
      }))
      .orElse((error): AppResultAsync<null, WebsiteSourceError> =>
        this.isAbsent(error) ? okAsync(null) : errAsync(error as WebsiteSourceError),
      );
  }
}
