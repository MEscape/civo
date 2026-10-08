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
import { toWebsiteView } from '../website-view-mappers';

import type { Website } from '../../domain/models/website';
import type { TemplateKey } from '../../domain/models/website-template';
import type { HomePageProvisioningError } from '../../domain/ports/home-page-provisioner.port';
import type { CreateWebsiteInput, WebsiteView } from '../contracts/website-views';
import type { CreateWebsiteDependencies } from '../website-dependencies';

export type CreateWebsiteError =
  | AuthorizationError
  | ValidationAppError
  | ConflictAppError
  | InfrastructureAppError
  | UnexpectedAppError;

/**
 * Creates a website and its template-generated home page.
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

    return authorization.requireInTenant('website.create').andThen((actor) =>
      createWebsiteDraft(input)
        .asyncAndThen((draft) =>
          websites
            .create({
              tenantId: actor.tenantId,
              draft,
              theme: DEFAULT_WEBSITE_THEME,
            })
            .map((website) => ({ website, templateKey: draft.templateKey })),
        )
        .andThen(({ website, templateKey }) =>
          this.provisionHomePage(website, templateKey).map((provisioned) => ({
            website: provisioned,
            templateKey,
          })),
        )
        .map(({ website, templateKey }) => {
          audit.record({
            type: 'website.created',
            actorId: actor.id,
            tenantId: actor.tenantId,
            websiteId: website.id,
            templateKey,
          });
          return toWebsiteView(website);
        }),
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
