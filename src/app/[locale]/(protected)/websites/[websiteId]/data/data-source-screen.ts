import { getBuilderQueries } from '@modules/builder';
import { builderRoutes } from '@modules/builder/client';
import { loadComponentLabels } from '@modules/component-platform';
import { getMapQueries } from '@modules/map';
import { mapRoutes } from '@modules/map/client';
import { getReleaseQueries } from '@modules/release';
import { deleteUnusedDataAction, releaseRoutes } from '@modules/release/client';

import { DEFAULT_PAGE_LIMITS } from '@lib/pagination';

import type { getWebsiteAccess } from '@/app/_lib/website-access';

type WebsiteAccess = Awaited<ReturnType<typeof getWebsiteAccess>>;

/**
 * What the data-source screens take from their neighbours, in one place so the list and a source's
 * own page cannot drift apart: what the person may do, where each dataset is used (read from the
 * builder, the saved maps and the live release: the same three places the deletion guard checks),
 * and the deletion that first checks nothing shows the data. The data-sources module cannot import
 * those modules without a cycle, so the route hands them in.
 */
export function dataSourceScreen(access: WebsiteAccess) {
  return {
    capabilities: {
      canCreateSource: access.may('datasource.create'),
      canUpdateSource: access.may('datasource.update'),
      canDeleteSource: access.may('datasource.delete'),
      canTestSource: access.may('datasource.test'),
      canCreateDataset: access.may('dataset.create'),
      canUpdateDataset: access.may('dataset.update'),
      canDeleteDataset: access.may('dataset.delete'),
      canMapDataset: access.may('dataset.map'),
    },
    deleteData: deleteUnusedDataAction,
    readers:
      access.may('page.read') && access.may('release.read')
        ? {
            drafts: getBuilderQueries().listDatasetUsage,
            live: getReleaseQueries().listLiveDatasetUsage,
            maps: {
              // One page of the most a list returns; a longer list reads as incomplete, never as unused.
              execute: (websiteId: string) =>
                getMapQueries().listSavedMaps.execute(websiteId, {
                  page: 1,
                  pageSize: DEFAULT_PAGE_LIMITS.maxPageSize,
                }),
            },
            labels: loadComponentLabels,
            editorHref: builderRoutes.editor,
            componentHref: builderRoutes.component,
            releasesHref: releaseRoutes.releases,
            mapHref: mapRoutes.edit,
          }
        : null,
  };
}
