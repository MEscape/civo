import type { ActorId } from '@modules/auth';

import type { DataIssues } from '../features/map-features';
import type { MapId, WebsiteId } from '../models/ids';

/** A person saved a map configuration. */
export interface MapSavedEvent {
  readonly type: 'map.created' | 'map.updated';
  readonly actorId: ActorId;
  readonly websiteId: WebsiteId;
  readonly mapId: MapId;
  readonly version: number;
}

/** A person deleted a map configuration no page placed any more. */
export interface MapDeletedEvent {
  readonly type: 'map.deleted';
  readonly actorId: ActorId;
  readonly websiteId: WebsiteId;
  readonly mapId: MapId;
}

/**
 * Some features of external data were left out of a render. A recoverable anomaly nobody acted
 * on, so it names no actor: it is logged for alerting and stays out of the audit trail.
 */
export interface MapFeaturesDroppedEvent extends DataIssues {
  readonly type: 'map.features_dropped';
}

export type MapEvent = MapSavedEvent | MapDeletedEvent | MapFeaturesDroppedEvent;

export interface MapAuditLog {
  record(event: MapEvent): void;
}
