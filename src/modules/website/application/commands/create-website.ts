import type { AuthorizationError } from '@modules/auth';

import type {
  ConflictAppError,
  InfrastructureAppError,
  UnexpectedAppError,
  ValidationAppError,
} from '@lib/errors';
import { errAsync, okAsync } from '@lib/result';
import type { AppResultAsync } from '@lib/result';

import { createWebsiteDraft } from '../../domain/models/website';
import { DEFAULT_WEBSITE_THEME } from '../../domain/models/website-theme';
import { getTemplate } from '../../domain/templates/template-registry';
import { WEBSITE_RATE_LIMITS } from '../rate-limits';
import { withinActorLimit } from '../services/within-actor-limit';
import { toWebsiteView } from '../website-view-mappers';

import type { Website } from '../../domain/models/website';
import type { TemplateKey } from '../../domain/models/website-template';
import type { HomePageProvisioningError } from '../../domain/ports/home-page-provisioner.port';
import type { CreateWebsiteInput, WebsiteView } from '../contracts/website-views';
import type { ActorLimitError } from '../services/within-actor-limit';
import type { CreateWebsiteDependencies } from '../website-dependencies';

type CreateWebsiteError =
  | AuthorizationError
  | ValidationAppError
  | ConflictAppError
  | InfrastructureAppError
  | UnexpectedAppError
  | ActorLimitError;

/**
 * Creates a website, as its own tenant, and its template-generated home page.
 * Only the platform administrator may.
 *
 * The two writes live in different modules and cannot share a transaction,
 * so a failed home page is compensated by deleting the website again. The
 * caller can then retry with the same slug instead of hitting a conflict
 * with a half-created site.
 */
export class CreateWebsite {
  constructor(private readonly deps: CreateWebsiteDependencies) {}

  execute(input: CreateWebsiteInput): AppResultAsync<WebsiteView, CreateWebsiteError> {
    const { authorization, websites, audit } = this.deps;

    return authorization
      .requireInTenant('website.create')
      .andThen(
        withinActorLimit(this.deps, WEBSITE_RATE_LIMITS.create, (actor) => ({
          actorId: actor.id,
          tenantId: actor.tenantId,
        })),
      )
      .andThen((actor) =>
        createWebsiteDraft(input).asyncAndThen((draft) =>
          websites
            .create({ draft, theme: DEFAULT_WEBSITE_THEME })
            .andThen((website) => this.provisionHomePage(website, draft.templateKey))
            .map((website) => {
              audit.record({
                type: 'website.created',
                actorId: actor.id,
                tenantId: website.tenantId,
                websiteId: website.id,
                templateKey: draft.templateKey,
              });
              return toWebsiteView(website);
            }),
        ),
      );
  }

  private provisionHomePage(
    website: Website,
    templateKey: TemplateKey,
  ): AppResultAsync<Website, HomePageProvisioningError> {
    return this.deps.homePages
      .provision({
        tenantId: website.tenantId,
        websiteId: website.id,
        blueprint: getTemplate(templateKey).homePage,
      })
      .map(() => website)
      .orElse((error) => this.rollBack(website, error));
  }

  /** The provisioning error always wins; a failed rollback is logged, not returned. */
  private rollBack(
    website: Website,
    cause: HomePageProvisioningError,
  ): AppResultAsync<never, HomePageProvisioningError> {
    return this.deps.websites
      .deleteById(website.id, website.tenantId)
      .orElse((deleteError) => {
        this.deps.audit.record({
          type: 'website.provisioning_rollback_failed',
          tenantId: website.tenantId,
          websiteId: website.id,
          errorCode: deleteError.code,
        });
        return okAsync(undefined);
      })
      .andThen(() => errAsync(cause));
  }
}
