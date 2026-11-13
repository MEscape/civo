// @vitest-environment node
import { describe, expect, it } from 'vitest';

import {
  datasetProjection,
  projectPublicHtml,
  projectWikidataPlace,
  uniqueSourceRecords,
} from '../../scripts/wuerzburg/catalog-projection.mjs';

const dataset = {
  '@type': 'Dataset',
  name: 'Baumkataster',
  url: 'https://example.invalid/trees',
  license: 'https://example.invalid/license',
  keywords: ['Bäume'],
  dateModified: '2026-06-30T07:01:40Z',
  distribution: [
    {
      '@type': 'DataDownload',
      encodingFormat: 'GeoJSON',
      contentUrl: 'https://example.invalid/trees.geojson',
    },
  ],
};

describe('public catalog projection', () => {
  it('collapses exact duplicate public places and rejects conflicting source identities', () => {
    const place = { id: 'wc-1', name: 'Rathaus', latitude: 49.79 };
    expect(uniqueSourceRecords([place, { ...place }])).toEqual([place]);
    expect(() => uniqueSourceRecords([place, { ...place, latitude: 50 }])).toThrow(
      'Conflicting source identity',
    );
    expect(() => uniqueSourceRecords([{ name: 'Rathaus' }])).toThrow('Missing source identity');
  });
  it('captures only a verified building coordinate and rejects non-Earth or missing positions', () => {
    const entity = {
      id: 'Q1',
      labels: { de: { value: 'Rathaus' } },
      claims: {
        P625: [
          {
            mainsnak: {
              datavalue: {
                value: {
                  latitude: 49.79,
                  longitude: 9.93,
                  globe: 'http://www.wikidata.org/entity/Q2',
                },
              },
            },
          },
        ],
        P969: [{ mainsnak: { datavalue: { value: { text: 'Rückermainstraße 2' } } } }],
        P50: [{ mainsnak: { datavalue: { value: 'person@example.invalid' } } }],
      },
    };
    const result = projectWikidataPlace(JSON.stringify({ entities: { Q1: entity } }));
    expect(JSON.parse(result.body).records).toEqual([
      {
        id: 'Q1',
        name: 'Rathaus',
        address: 'Rückermainstraße 2',
        latitude: 49.79,
        longitude: 9.93,
      },
    ]);
    expect(result.body).not.toContain('person@example.invalid');
    const withoutAddress = { ...entity, claims: { P625: entity.claims.P625 } };
    expect(
      JSON.parse(projectWikidataPlace(JSON.stringify({ entities: { Q1: withoutAddress } })).body)
        .records[0],
    ).not.toHaveProperty('address');
    const moon = structuredClone(entity);
    moon.claims.P625[0]!.mainsnak.datavalue.value.globe = 'http://www.wikidata.org/entity/Q405';
    expect(() => projectWikidataPlace(JSON.stringify({ entities: { Q1: moon } }))).toThrow(
      'Invalid Wikidata place',
    );
    expect(() =>
      projectWikidataPlace(JSON.stringify({ entities: { Q1: { ...entity, claims: {} } } })),
    ).toThrow('Invalid Wikidata place');
    expect(() => projectWikidataPlace('{"entities":{}}')).toThrow('Expected one Wikidata place');
  });

  it('preserves source-delivered names, taxonomy, license, modification date and distributions', () => {
    expect(datasetProjection(dataset)).toMatchObject(dataset);
  });
  it('omits personal and unreviewed descriptive fields', () => {
    const result = datasetProjection({
      ...dataset,
      creator: { name: 'Person', email: 'person@example.invalid' },
      description: 'Contact person@example.invalid',
      contactPoint: { telephone: 'fictional' },
    });
    expect(result).not.toHaveProperty('creator');
    expect(result).not.toHaveProperty('description');
    expect(result).not.toHaveProperty('contactPoint');
  });
  it('rejects unsafe or credential-bearing links', () => {
    for (const url of [
      'javascript:alert(1)',
      'https://user:password@example.invalid/',
      'https://example.invalid/?api_key=demo',
    ]) {
      expect(datasetProjection({ ...dataset, url })).toBeNull();
      expect(
        datasetProjection({
          ...dataset,
          distribution: [{ encodingFormat: 'JSON', contentUrl: url }],
        }).distribution,
      ).toEqual([]);
    }
  });
  it('extracts only allowlisted JSON-LD, never portal script configuration', () => {
    const html = `<script>const jawg_apikey='fictional-demo';</script><script type="application/ld+json">${JSON.stringify(dataset)}</script>`;
    const projected = projectPublicHtml(html);
    expect(projected.extension).toBe('json');
    expect(JSON.parse(projected.body)).toMatchObject(dataset);
    expect(projected.body).not.toContain('jawg_apikey');
  });
  it('keeps readable terms and removes scripts when no dataset metadata exists', () => {
    const result = projectPublicHtml(
      '<p>License and attribution</p><script>const token="fictional-demo";</script>',
    );
    expect(result.body).toBe('<p>License and attribution</p>');
  });
  it('does not treat invalid or non-Dataset embedded JSON as a verified record', () => {
    expect(projectPublicHtml('<script type="application/ld+json">{bad}</script>').extension).toBe(
      'html',
    );
    expect(datasetProjection({ '@type': 'Person', name: 'Person' })).toBeNull();
  });
});
