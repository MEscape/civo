import type {
  CreateSystemPageError,
  CreateSystemPageInput,
  PageNodeInput,
  PageSummaryView,
} from '@modules/builder';

import type { AppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import {
  homePageBlueprintRejected,
  homePageProvisioningFailed,
} from '../../domain/errors/website-errors';

import type { BlueprintNode } from '../../domain/models/website-template';
import type {
  HomePageProvisioner,
  HomePageProvisioningError,
} from '../../domain/ports/home-page-provisioner.port';

function toBuilderNode(node: BlueprintNode): PageNodeInput {
  return {
    id: node.key,
    type: node.type,
    props: node.props ?? {},
    children: (node.children ?? []).map(toBuilderNode),
  };
}

/** A rejected blueprint is a template bug; anything else is the builder being unavailable. */
function toProvisioningError(cause: AppError): HomePageProvisioningError {
  return cause.kind === 'validation'
    ? homePageBlueprintRejected(cause)
    : homePageProvisioningFailed(cause);
}

/**
 * The website module's ONLY dependency on the builder, through the
 * builder's public API. Everything the builder owns (component registry,
 * default props, page validation and storage) stays behind it.
 */
export class BuilderHomePageProvisioner implements HomePageProvisioner {
  constructor(
    private readonly createPage: (
      input: CreateSystemPageInput,
    ) => AppResultAsync<PageSummaryView, CreateSystemPageError>,
    private readonly homePagePath: string,
  ) {}

  provision(input: Parameters<HomePageProvisioner['provision']>[0]) {
    return this.createPage({
      tenantId: input.tenantId,
      websiteId: input.websiteId,
      path: this.homePagePath,
      title: input.blueprint.title,
      nodes: input.blueprint.nodes.map(toBuilderNode),
    })
      .map(() => undefined)
      .mapErr(toProvisioningError);
  }
}
