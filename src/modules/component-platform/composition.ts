import 'server-only';

import type { ReactNode } from 'react';
import { createElement } from 'react';

import { headers } from 'next/headers';

import { BookingSection } from '@modules/booking';
import { dataSourceQueries } from '@modules/data-sources';
import { MapSection } from '@modules/map';
import { mediaPublicUrl } from '@modules/media';

import type { Locale } from '@i18n';

import { systemClock } from '@lib/clock';
import { getClientAddressProvider, getRateLimiter } from '@lib/rate-limit';
import { assertNever, once } from '@lib/utils';

import { CanNestComponent } from './application/queries/can-nest-component';
import { GetComponentDefaultProps } from './application/queries/get-component-default-props';
import { GetComponentReleaseInfo } from './application/queries/get-component-release-info';
import { ListComponentCatalog } from './application/queries/list-component-catalog';
import { ListContent } from './application/queries/list-content';
import { ListContentCategories } from './application/queries/list-content-categories';
import { ReadTrendWindow } from './application/queries/read-trend-window';
import { COMPONENT_REGISTRY } from './domain/components/platform-registry';
import { DatasetContentSource } from './infrastructure/data-sources/dataset-content-source';
import { createPageRenderer } from './presentation/components/page-renderer/create-page-renderer';
import { createContentLoader } from './presentation/components/page-renderer/load-content';
import { PublishedSitePage } from './presentation/components/page-renderer/published-site-page';
import { translateComponentLabels } from './presentation/loaders/translate-component-labels';

import type { PublicComponentPlatformDependencies } from './application/component-platform-dependencies';
import type {
  RenderContext,
  RenderableNode,
} from './application/contracts/component-platform-constraints';

/**
 * The module's composition root: the one file that knows both the use cases
 * and their adapters, and the only one that reaches another module at runtime. The
 * data-sources use case is passed as a function, so the adapter depends on
 * what it needs and not on how data-sources is built. Like auth and media,
 * dependencies and use cases are process singletons built only when first
 * requested. `server-only` makes an accidental import from a Client
 * Component a build error.
 */
const getDependencies = once<PublicComponentPlatformDependencies>(() => ({
  registry: COMPONENT_REGISTRY,
  live: new DatasetContentSource((request) =>
    dataSourceQueries.getMappedDatasetRecords.execute(request),
  ),
  clock: systemClock,
}));

/** Every query is public: the catalog and published content carry no actor. Rendering one counts visitors, not users. */
export const getComponentPlatformQueries = once(() => {
  const dependencies = getDependencies();
  const listContent = new ListContent(dependencies);
  return {
    listContent,
    readTrendWindow: new ReadTrendWindow({
      listContent,
      rateLimiter: getRateLimiter(),
      clientAddress: getClientAddressProvider(() => headers()),
    }),
    listContentCategories: new ListContentCategories(dependencies),
    listComponentCatalog: new ListComponentCatalog(dependencies),
    canNestComponent: new CanNestComponent(dependencies),
    getComponentReleaseInfo: new GetComponentReleaseInfo(dependencies),
    getComponentDefaultProps: new GetComponentDefaultProps(dependencies),
  } as const;
});

/**
 * The page renderer, wired with what components need: a loader built from
 * `listContent`, the map and booking modules' sections for their components,
 * and the media module's address of an uploaded file. Presentation never
 * reaches this file or another module; all of it is handed in from here.
 */
const getPageRenderer = once(() =>
  createPageRenderer({
    loadContent: createContentLoader(getComponentPlatformQueries().listContent),
    mapSection: MapSection,
    bookingSection: BookingSection,
    mediaUrl: mediaPublicUrl,
  }),
);

/** Renders a page's node tree for the public site and the builder canvas alike. */
export function renderPageNodes(
  nodes: readonly RenderableNode[],
  context: RenderContext,
): ReactNode {
  return getPageRenderer()(nodes, context);
}

/** Public-site landmarks composed from the same stored nodes as the builder canvas. */
export function renderPublishedSitePage(
  nodes: readonly RenderableNode[],
  context: RenderContext,
): ReactNode {
  return createElement(PublishedSitePage, { nodes, context, renderNodes: renderPageNodes });
}

/** Translate catalog vocabulary without callers reading this module's namespace. */
export const loadComponentLabels = async (locale: Locale, types: readonly string[]) =>
  translateComponentLabels(
    locale,
    types,
    getComponentPlatformQueries()
      .listComponentCatalog.execute()
      .match((view) => view.components, assertNever),
  );
