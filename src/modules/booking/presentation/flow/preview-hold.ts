import { MS_PER_DAY } from '@lib/utils';

import type { SlotDto } from '../dto/availability-dto';
import type { HoldDto } from '../dto/booking-dto';

export const PREVIEW_HOLD_ID = 'preview';

export interface PreviewHoldInput {
  readonly slot: SlotDto;
  readonly timeZone: string;
  readonly participants: number;
  readonly serviceName: string;
  readonly locationName: string;
  readonly now: Date;
}

/**
 * The reservation the editor canvas pretends to hold, so the details and
 * review steps can be walked through. It exists only in the browser: the
 * server is never asked, so nothing is reserved and no slot is blocked. It
 * outlives any realistic visit, so the countdown never interrupts a preview.
 */
export function createPreviewHold({
  slot,
  timeZone,
  participants,
  serviceName,
  locationName,
  now,
}: PreviewHoldInput): HoldDto {
  return {
    holdId: PREVIEW_HOLD_ID,
    expiresAt: new Date(now.getTime() + MS_PER_DAY).toISOString(),
    start: slot.start,
    end: slot.end,
    localDate: slot.localDate,
    localTime: slot.localTime,
    participants,
    timeZone,
    serviceName,
    locationName,
  };
}
