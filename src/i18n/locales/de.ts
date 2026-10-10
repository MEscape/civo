import { deAuth as auth } from '@modules/auth';
import { deBooking as booking } from '@modules/booking';
import { deBuilder as builder } from '@modules/builder';
import { deComponentPlatform as componentPlatform } from '@modules/component-platform';
import { deDataSource as dataSource } from '@modules/data-sources';
import { deMap as map } from '@modules/map';
import { deRelease as release } from '@modules/release';
import { deWebsite as website } from '@modules/website';

import app from '../messages/de/app.json';

/**
 * The German catalog: the app shell's own namespace plus one namespace per
 * module, each owned and completed by its module. Nothing is merged across
 * namespaces, so a module's message map can only point at keys it owns.
 */
const messages = {
  app,
  auth: auth.auth,
  booking: booking.booking,
  builder: builder.builder,
  componentPlatform: componentPlatform.componentPlatform,
  dataSources: dataSource.dataSources,
  map: map.map,
  release: release.release,
  website: website.website,
} as const;

export default messages;
