import { describe, expect, it } from 'vitest';

import { AREA_PRESETS, areaModeOf } from '@modules/data-sources/presentation/forms/area-presets';
import {
  toFormFieldErrors,
  toRestConfig,
  toRestSourceForm,
} from '@modules/data-sources/presentation/schemas/rest-source-config-schema';
import { REST_SOURCE_FORM_DEFAULTS } from '@modules/data-sources/presentation/schemas/rest-source-form-schema';

describe('the area filter in the source form', () => {
  it('submits nothing when both fields are empty, and what was typed otherwise', () => {
    expect(toRestConfig(REST_SOURCE_FORM_DEFAULTS)['spatialFilter']).toBeUndefined();
    expect(
      toRestConfig({ ...REST_SOURCE_FORM_DEFAULTS, areaParam: 'bbox', areaTemplate: '{west}' })[
        'spatialFilter'
      ],
    ).toEqual({ param: 'bbox', template: '{west}' });
  });

  it("starts an edit from the stored filter, and puts the server's errors on its fields", () => {
    const form = toRestSourceForm({
      id: 's',
      websiteId: 'w',
      name: 'Places',
      kind: 'REST',
      connection: {
        baseUrl: 'https://api.example.org',
        hasHiddenUrlParts: false,
        authMode: 'NONE',
        recordsPath: null,
        pagination: { kind: 'none' },
        spatialFilter: AREA_PRESETS.ogc,
      },
    });
    expect(form).toMatchObject({
      areaParam: 'bbox',
      areaTemplate: '{west},{south},{east},{north}',
    });
    expect(
      toFormFieldErrors({
        code: 'x',
        message: '',
        fieldErrors: {
          'config.spatialFilter.param': ['a'],
          'config.spatialFilter.template': ['b'],
          'config.spatialFilter': ['c'],
        },
      }).fieldErrors,
    ).toEqual({ areaParam: ['c'], areaTemplate: ['b'] });
  });

  it('recognises a preset by its exact settings, anything else typed as other', () => {
    expect(areaModeOf('', '')).toBe('none');
    expect(areaModeOf(AREA_PRESETS.socrata.param, AREA_PRESETS.socrata.template)).toBe('socrata');
    expect(areaModeOf('where', 'mine({west})')).toBe('custom');
  });
});
