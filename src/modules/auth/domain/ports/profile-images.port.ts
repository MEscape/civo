import type { InfrastructureAppError } from '@lib/errors';
import type { AppResultAsync } from '@lib/result';

import type { ActorId } from '../models/ids';
import type { ProfileImage } from '../models/profile';

/** Only internally generated URLs in the actor's own storage prefix can be removed. */
export interface ProfileImages {
  upload(actorId: ActorId, image: ProfileImage): AppResultAsync<string, InfrastructureAppError>;
  remove(actorId: ActorId, url: string): AppResultAsync<void, InfrastructureAppError>;
}
