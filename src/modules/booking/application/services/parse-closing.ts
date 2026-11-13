import type { ValidationAppError } from '@lib/errors';
import { err, ok } from '@lib/result';
import type { AppResult } from '@lib/result';

import {
  BOOKING_VALIDATION_CODES as CODES,
  fieldValidationFailed,
} from '../../domain/errors/booking-errors';
import { DEACTIVATION_MODES } from '../contracts/booking-constraints';

import { parseResolutions } from './closing-resolutions';
import { parseVersion } from './parse-version';
import { parseScope } from './service-impact';

import type { BookingId } from '../../domain/models/ids';
import type { Instant } from '../../domain/time/instant';
import type {
  DeactivationMode,
  DeactivationScope,
  ServiceResolution,
} from '../contracts/booking-constraints';
import type { DeactivateServiceInput } from '../contracts/service-inputs';

/** What a closing was asked to do, read and validated. */
export interface Closing {
  readonly scope: DeactivationScope;
  readonly mode: DeactivationMode;
  readonly decided: ReadonlyMap<BookingId, ServiceResolution>;
  readonly version: Instant;
  readonly settingVersion: Instant;
}

function parseMode(raw: string): AppResult<DeactivationMode, ValidationAppError> {
  const mode = DEACTIVATION_MODES.find((candidate) => candidate === raw);
  return mode === undefined ? err(fieldValidationFailed('mode', CODES.idInvalid)) : ok(mode);
}

/** Reads the scope, the mode, the decisions and both versions of a closing, the first fault first. */
export function parseClosing(
  input: DeactivateServiceInput,
): AppResult<Closing, ValidationAppError> {
  return parseScope(input.scope).andThen((scope) =>
    parseMode(input.mode).andThen((mode) =>
      parseResolutions(input.resolutions).andThen((decided) =>
        parseVersion('expectedVersion', input.expectedVersion).andThen((version) =>
          parseVersion('expectedSettingVersion', input.expectedSettingVersion).map(
            (settingVersion): Closing => ({ scope, mode, decided, version, settingVersion }),
          ),
        ),
      ),
    ),
  );
}
