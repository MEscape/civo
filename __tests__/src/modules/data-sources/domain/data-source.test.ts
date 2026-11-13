import { describe, expect, it } from 'vitest';

import { parseRestConnectionConfig } from '@modules/data-sources/domain/config/rest-connection-config';
import {
  DATA_SOURCE_ERROR_CODES,
  DATA_SOURCE_VALIDATION_CODES,
  addressNotAllowed,
  authenticationFailed,
  connectionFailed,
  connectionTimedOut,
  connectorUnavailable,
  credentialsMissing,
  dataSourceNotFound,
  datasetInUse,
  datasetNotFound,
  datasetNotMapped,
  datasetSlugTaken,
  fieldValidationFailed,
  fromRateLimitFailure,
  noSampleRecords,
  persistenceFailed,
  recordsNotFound,
  responseNotJson,
  responseTooLarge,
  responseUnreadable,
  upstreamError,
  upstreamRedirected,
  websiteNotFoundForDataSource,
} from '@modules/data-sources/domain/errors/data-source-errors';
import {
  DATA_SOURCE_LIMITS,
  createDataSourceDraft,
} from '@modules/data-sources/domain/models/data-source';

describe('data-source domain model and errors', () => {
  describe('createDataSourceDraft', () => {
    it('creates a draft for a valid REST data source', () => {
      const result = createDataSourceDraft({
        websiteId: 'website-1',
        name: 'Municipal Portal API',
        kind: 'REST',
        config: {
          baseUrl: 'https://api.example.com/v1',
          path: '/events',
          authMode: 'NONE',
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          websiteId: 'website-1',
          name: 'Municipal Portal API',
          kind: 'REST',
          config: {
            baseUrl: 'https://api.example.com/v1',
            path: '/events',
            authMode: 'NONE',
            method: 'GET',
            requestBody: null,
            recordsPath: null,
            pagination: { kind: 'none' },
          },
        });
      }
    });

    it('keeps the records path and pagination of a REST source, in a form that parses again', () => {
      const result = createDataSourceDraft({
        websiteId: 'website-1',
        name: 'Paged API',
        kind: 'REST',
        config: {
          baseUrl: 'https://api.example.com/v1',
          recordsPath: 'data.items',
          pagination: { kind: 'page', pageParam: 'p', pageSize: 50 },
        },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.config).toMatchObject({
          recordsPath: 'data.items',
          pagination: { kind: 'page', pageParam: 'p', pageSize: 50, sizeParam: null },
        });
        expect(parseRestConnectionConfig(result.value.config).isOk()).toBe(true);
      }
    });

    it('creates a draft for a valid MOCK data source', () => {
      const result = createDataSourceDraft({
        websiteId: 'website-1',
        name: 'Mock Events Provider',
        kind: 'MOCK',
        config: {},
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.kind).toBe('MOCK');
        expect(result.value.config).toEqual({});
      }
    });

    it('validates name boundaries', () => {
      const tooShort = createDataSourceDraft({
        websiteId: 'website-1',
        name: 'A',
        kind: 'MOCK',
        config: {},
      });
      expect(tooShort.isErr()).toBe(true);
      if (tooShort.isErr()) {
        expect(tooShort.error.fieldErrors['name']).toContain(
          DATA_SOURCE_VALIDATION_CODES.nameTooShort,
        );
      }

      const tooLong = createDataSourceDraft({
        websiteId: 'website-1',
        name: 'A'.repeat(DATA_SOURCE_LIMITS.nameMax + 1),
        kind: 'MOCK',
        config: {},
      });
      expect(tooLong.isErr()).toBe(true);
      if (tooLong.isErr()) {
        expect(tooLong.error.fieldErrors['name']).toContain(
          DATA_SOURCE_VALIDATION_CODES.nameTooLong,
        );
      }
    });

    it('validates kind and rejects unknown kind', () => {
      const result = createDataSourceDraft({
        websiteId: 'website-1',
        name: 'GraphQL Source',
        kind: 'GRAPHQL',
        config: {},
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['kind']).toContain(
          DATA_SOURCE_VALIDATION_CODES.kindUnknown,
        );
      }
    });

    it('validates mock config rejects unexpected keys', () => {
      const result = createDataSourceDraft({
        websiteId: 'website-1',
        name: 'Mock With Extras',
        kind: 'MOCK',
        config: { extraKey: 'value' },
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['config']).toContain(
          DATA_SOURCE_VALIDATION_CODES.configInvalid,
        );
      }
    });

    it('validates rest config', () => {
      const result = createDataSourceDraft({
        websiteId: 'website-1',
        name: 'REST With Bad URL',
        kind: 'REST',
        config: {
          baseUrl: 'ftp://bad-scheme.com',
          path: '/data',
          authMode: 'NONE',
        },
      });
      expect(result.isErr()).toBe(true);
    });

    it('validates invalid websiteId', () => {
      const result = createDataSourceDraft({
        websiteId: '',
        name: 'Valid Name',
        kind: 'MOCK',
        config: {},
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['websiteId']).toContain(
          DATA_SOURCE_VALIDATION_CODES.idInvalid,
        );
      }
    });
  });

  describe('data-source domain error factories', () => {
    it('creates not found errors', () => {
      expect(dataSourceNotFound().code).toBe(DATA_SOURCE_ERROR_CODES.dataSourceNotFound);
      expect(datasetNotFound().code).toBe(DATA_SOURCE_ERROR_CODES.datasetNotFound);
      expect(websiteNotFoundForDataSource().code).toBe(DATA_SOURCE_ERROR_CODES.websiteNotFound);
    });

    it('creates conflict errors', () => {
      expect(datasetSlugTaken().code).toBe(DATA_SOURCE_ERROR_CODES.datasetSlugTaken);
      expect(datasetInUse().code).toBe(DATA_SOURCE_ERROR_CODES.datasetInUse);
      expect(datasetNotMapped().code).toBe(DATA_SOURCE_ERROR_CODES.datasetNotMapped);
    });

    it('creates validation errors', () => {
      const err = fieldValidationFailed('name', DATA_SOURCE_VALIDATION_CODES.nameTooShort);
      expect(err.code).toBe(DATA_SOURCE_ERROR_CODES.validationFailed);
      expect(err.fieldErrors['name']).toEqual([DATA_SOURCE_VALIDATION_CODES.nameTooShort]);
    });

    it('creates rate limiting errors', () => {
      const fromFailure = fromRateLimitFailure({
        kind: 'rate_limited',
        code: 'rate_limit.exceeded',
        message: 'Limit exceeded.',
        retryAfterSeconds: 30,
      });
      expect(fromFailure.code).toBe(DATA_SOURCE_ERROR_CODES.rateLimited);

      const fromInfrastructure = fromRateLimitFailure({
        kind: 'infrastructure',
        code: 'rate_limit.persistence_failed',
        message: 'Limiter unavailable.',
        cause: new Error('redis down'),
      });
      expect(fromInfrastructure.code).toBe(DATA_SOURCE_ERROR_CODES.rateLimiterFailed);
    });

    it('creates infrastructure and connection errors', () => {
      expect(persistenceFailed('db error').code).toBe(DATA_SOURCE_ERROR_CODES.persistenceFailed);
      expect(connectionFailed('offline').code).toBe(DATA_SOURCE_ERROR_CODES.connectionFailed);
      expect(connectionTimedOut().code).toBe(DATA_SOURCE_ERROR_CODES.connectionTimedOut);
      expect(authenticationFailed().code).toBe(DATA_SOURCE_ERROR_CODES.authenticationFailed);
      expect(upstreamError().code).toBe(DATA_SOURCE_ERROR_CODES.upstreamError);
      expect(upstreamRedirected().code).toBe(DATA_SOURCE_ERROR_CODES.upstreamRedirected);
      expect(responseTooLarge().code).toBe(DATA_SOURCE_ERROR_CODES.responseTooLarge);
      expect(responseUnreadable().code).toBe(DATA_SOURCE_ERROR_CODES.responseUnreadable);
      expect(responseNotJson().code).toBe(DATA_SOURCE_ERROR_CODES.responseNotJson);
      expect(noSampleRecords().code).toBe(DATA_SOURCE_ERROR_CODES.noSampleRecords);
      expect(recordsNotFound().code).toBe(DATA_SOURCE_ERROR_CODES.recordsNotFound);
      expect(credentialsMissing().code).toBe(DATA_SOURCE_ERROR_CODES.credentialsMissing);
      expect(connectorUnavailable().code).toBe(DATA_SOURCE_ERROR_CODES.connectorUnavailable);
      expect(addressNotAllowed().code).toBe(DATA_SOURCE_ERROR_CODES.addressNotAllowed);
    });
  });
});
