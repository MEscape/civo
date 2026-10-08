import { enAuth as auth } from '@modules/auth';
import { enBuilder as builder } from '@modules/builder';
import { enComponentPlatform as componentPlatform } from '@modules/component-platform';
import { enDataSource as dataSource } from '@modules/data-sources';
import { enMap as map } from '@modules/map';
import { enRelease as release } from '@modules/release';
import { enWebsite as website } from '@modules/website';

import app from '../messages/en/app.json';

/**
 * The English catalog: the app shell's own namespace plus one namespace per
 * module, each owned and completed by its module. Nothing is merged across
 * namespaces, so a module's message map can only point at keys it owns.
 */
const messages = {
  app,
  auth: auth.auth,
  builder: builder.builder,
  componentPlatform: componentPlatform.componentPlatform,
  dataSources: dataSource.dataSources,
  map: map.map,
  release: release.release,
  website: website.website,
} as const;

export default messages;
