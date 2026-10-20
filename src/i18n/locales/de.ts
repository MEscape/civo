import { deAudit as audit } from '@modules/audit';
import { deAuth as auth } from '@modules/auth';
import { deBooking as booking } from '@modules/booking';
import { deBuilder as builder } from '@modules/builder';
import { deComponentPlatform as componentPlatform } from '@modules/component-platform';
import { deDataSource as dataSource } from '@modules/data-sources';
import { deMap as map } from '@modules/map';
import { deRelease as release } from '@modules/release';
import { deWebsite as website } from '@modules/website';

import deApp from '../messages/de.json';

import type { MessageCatalog, TranslationSchema } from '../config';

/**
 * The German catalog:
 * Statically verified against the English `MessageCatalog` schema via `satisfies`.
 * Any missing, extra, or structurally mismatched key in `de.json` or any module's
 * German bundle will fail TypeScript compilation immediately.
 */
const messages = {
  app: deApp,
  audit: audit.audit,
  auth: auth.auth,
  booking: booking.booking,
  builder: builder.builder,
  componentPlatform: componentPlatform.componentPlatform,
  dataSources: dataSource.dataSources,
  map: map.map,
  release: release.release,
  website: website.website,
} as const satisfies TranslationSchema<MessageCatalog>;

export default messages;
