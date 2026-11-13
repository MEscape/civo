import { describe, expect, it } from 'vitest';

import {
  RELEASE_ERROR_CODES,
  RELEASE_VALIDATION_CODES,
  createReleasePublishBlockedBag,
  createReleaseValidationBag,
  fieldValidationFailed,
  fromRateLimitFailure,
  rateLimited,
  releaseMigrationAlreadyApplied,
  releaseMigrationNotFound,
  releaseMigrationPlanCorrupted,
  releaseMigrationStale,
  releaseNotFound,
  releaseNotPublished,
  releaseNotRestorable,
  releaseNumberConflict,
  releasePublishBlocked,
  releaseSnapshotCorrupted,
  releaseSourceFailed,
  releaseValidationFailed,
  releaseWebsiteNotFound,
} from '@modules/release/domain/errors/release-errors';

import { infrastructureError, rateLimitedError } from '@lib/errors';

describe('release domain error factories', () => {
  it('creates not found errors', () => {
    expect(releaseNotFound().code).toBe(RELEASE_ERROR_CODES.notFound);
    expect(releaseWebsiteNotFound().code).toBe(RELEASE_ERROR_CODES.websiteNotFound);
    expect(releaseNotPublished().code).toBe(RELEASE_ERROR_CODES.notPublished);
    expect(releaseMigrationNotFound().code).toBe(RELEASE_ERROR_CODES.migrationNotFound);
  });

  it('creates conflict errors', () => {
    expect(releaseNotRestorable().code).toBe(RELEASE_ERROR_CODES.notRestorable);
    expect(releaseNumberConflict().code).toBe(RELEASE_ERROR_CODES.numberConflict);
    expect(releaseMigrationAlreadyApplied().code).toBe(RELEASE_ERROR_CODES.migrationAlreadyApplied);
    expect(releaseMigrationStale().code).toBe(RELEASE_ERROR_CODES.migrationStale);
  });

  it('creates validation and publish blocked errors', () => {
    const valErr = releaseValidationFailed({ title: [RELEASE_VALIDATION_CODES.idInvalid] });
    expect(valErr.code).toBe(RELEASE_ERROR_CODES.validationFailed);

    const singleField = fieldValidationFailed('pages', RELEASE_VALIDATION_CODES.noPages);
    expect(singleField.fieldErrors['pages']).toEqual([RELEASE_VALIDATION_CODES.noPages]);

    const blocked = releasePublishBlocked({
      'pages.home': [RELEASE_VALIDATION_CODES.pageConfigMissing],
    });
    expect(blocked.code).toBe(RELEASE_ERROR_CODES.publishBlocked);

    const valBag = createReleaseValidationBag();
    valBag.add('id', RELEASE_VALIDATION_CODES.idInvalid);
    expect(valBag.hasErrors).toBe(true);

    const publishBag = createReleasePublishBlockedBag();
    publishBag.add('pages', RELEASE_VALIDATION_CODES.noPages);
    expect(publishBag.hasErrors).toBe(true);
  });

  it('creates rate limiting errors', () => {
    const rl = rateLimited(60);
    expect(rl.code).toBe(RELEASE_ERROR_CODES.rateLimited);
    expect(rl.retryAfterSeconds).toBe(60);

    const rlFromFail = fromRateLimitFailure(
      rateLimitedError('rate_limit.exceeded', 'Too many.', 15),
    );
    expect(rlFromFail.code).toBe(RELEASE_ERROR_CODES.rateLimited);

    const infraFromFail = fromRateLimitFailure(
      infrastructureError('rate_limit.backend_unavailable', 'Store down.', 'redis down'),
    );
    expect(infraFromFail.code).toBe(RELEASE_ERROR_CODES.rateLimiterFailed);
  });

  it('creates infrastructure and unexpected corruption errors', () => {
    expect(releaseSourceFailed('source down').code).toBe(RELEASE_ERROR_CODES.sourceFailed);
    expect(releaseSnapshotCorrupted('bad json').code).toBe(RELEASE_ERROR_CODES.snapshotCorrupted);
    expect(releaseMigrationPlanCorrupted('corrupt').code).toBe(
      RELEASE_ERROR_CODES.migrationPlanCorrupted,
    );
  });
});
