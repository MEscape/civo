import { describe, expect, it } from 'vitest';

import { toDataSourceSettingsView } from '@modules/data-sources/application/data-source-view-mappers';
import { parseRestConnectionConfig } from '@modules/data-sources/domain/config/rest-connection-config';
import {
  editableBaseUrl,
  mergeRestSettings,
} from '@modules/data-sources/domain/config/rest-connection-settings';
import { DATA_SOURCE_VALIDATION_CODES } from '@modules/data-sources/domain/errors/data-source-errors';
import { parseDataSourceChanges } from '@modules/data-sources/domain/models/data-source';

import { SOURCE } from '../support/data-source-fixtures';

const STORED = {
  baseUrl: 'https://api.example.com/v1?apiKey=secret#top',
  path: '/events',
  authMode: 'NONE',
  method: 'POST',
  requestBody: { filter: 'all' },
  recordsPath: 'data.items',
  pagination: { kind: 'offset', limitParam: 'limit', offsetParam: 'offset', placement: 'body' },
};

describe('editing a REST connection', () => {
  it('shows the base URL without a query or fragment, and says that something is hidden', () => {
    expect(editableBaseUrl(STORED.baseUrl)).toEqual({
      baseUrl: 'https://api.example.com/v1',
      hasHiddenParts: true,
    });
    expect(editableBaseUrl('https://api.example.com/v1')).toEqual({
      baseUrl: 'https://api.example.com/v1',
      hasHiddenParts: false,
    });
  });

  it('never hands the stored query (a possible token) to the edit form', () => {
    const view = toDataSourceSettingsView({ ...SOURCE, config: STORED });

    expect(JSON.stringify(view)).not.toContain('secret');
    expect(view.connection).toMatchObject({
      baseUrl: 'https://api.example.com/v1',
      hasHiddenUrlParts: true,
      recordsPath: 'data.items',
    });
  });

  it('keeps the stored address, path, method, body and unedited pagination when the shown address is sent back', () => {
    const merged = mergeRestSettings(STORED, {
      baseUrl: 'https://api.example.com/v1',
      authMode: 'API_KEY',
      pagination: { kind: 'offset', limitParam: 'size', offsetParam: 'from' },
    });

    expect(merged).toEqual({
      baseUrl: STORED.baseUrl,
      path: '/events',
      method: 'POST',
      requestBody: { filter: 'all' },
      authMode: 'API_KEY',
      pagination: { kind: 'offset', limitParam: 'size', offsetParam: 'from', placement: 'body' },
    });
    expect(parseRestConnectionConfig(merged).isOk()).toBe(true);
  });

  it('replaces the stored address, hidden query included, when another one is entered', () => {
    const merged = mergeRestSettings(STORED, {
      baseUrl: 'https://other.example.com/api',
      pagination: { kind: 'none' },
    });

    expect(merged).toMatchObject({
      baseUrl: 'https://other.example.com/api',
      pagination: { kind: 'none' },
    });
  });

  it('validates an edit like a new source and refuses an address the policy forbids', () => {
    const changes = parseDataSourceChanges(
      { kind: 'REST', config: STORED },
      { name: 'Events', config: { baseUrl: 'http://127.0.0.1/admin' } },
    );

    expect(changes.isErr()).toBe(true);
    if (changes.isErr()) {
      expect(changes.error.fieldErrors?.['config.baseUrl']).toBeDefined();
    }
  });

  it('refuses a name that is too short', () => {
    const changes = parseDataSourceChanges(
      { kind: 'REST', config: STORED },
      { name: ' x ', config: { baseUrl: 'https://api.example.com/v1' } },
    );

    expect(changes.isErr()).toBe(true);
    if (changes.isErr()) {
      expect(changes.error.fieldErrors?.['name']).toContain(
        DATA_SOURCE_VALIDATION_CODES.nameTooShort,
      );
    }
  });
});
