import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';

import { civicSite } from './civic-site.mjs';

const WATER_CATEGORY = 'Main und Gewässer';
const WATER_LEVEL_DATASET = 'water-level';

const ROOT = new URL('../../', import.meta.url);
const EPOCH = '2026-11-06T08:00:00.000Z';
const readJson = async (path) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
const provenance = (sourceId, kind = 'synthetic', extra = {}) => ({
  kind,
  sourceId,
  sourceUrl: null,
  fetchedAt: EPOCH,
  validUntil: null,
  license: null,
  licenseUrl: null,
  attribution: null,
  ...extra,
});
const sources = [];
const datasets = [];
const dataId = (key) => `wuerzburg-dataset-${key}`;
function dataset(
  key,
  name,
  kind,
  records,
  evidence = provenance(`wuerzburg-${key}`),
  fields = null,
) {
  sources.push({
    id: `wuerzburg-source-${key}`,
    name: `${evidence.kind === 'synthetic' ? 'Synthetisch' : 'Momentaufnahme'}: ${name}`,
    kind: 'MOCK',
    config: {
      schemaVersion: 1,
      records: records.map((record) => ({ ...record, _provenance: evidence })),
      provenance: evidence,
      windowPolicy: {
        schemaVersion: 1,
        maxRecords: kind === 'GeoFeature' ? 10000 : 1000,
        maxOffset: 100000,
        orderBy:
          kind === 'SmartCityObservation' ? { field: 'observedAt', direction: 'desc' } : null,
      },
    },
  });
  const keys =
    fields ??
    [...new Set(records.flatMap((record) => Object.keys(record)))].filter(
      (field) => !['id', '_provenance'].includes(field),
    );
  datasets.push({
    id: dataId(key),
    sourceId: `wuerzburg-source-${key}`,
    name,
    slug: key,
    canonicalKind: kind,
    mapping: {
      fields: keys.map((field) => ({ sourcePath: field, targetPath: field, required: false })),
    },
  });
  return dataId(key);
}

const pegel = await readJson('data/fixtures/pegel-main/response.json');
const pegelCapture = await readJson('data/fixtures/pegel-main/response.meta.json');
const station = pegel.find((item) => item.longname === 'WÜRZBURG');
if (!station) throw new Error('Recorded PEGELONLINE response has no Würzburg station');
const gaugeSeries = station.timeseries.find((series) => series.shortname === 'W');
if (!gaugeSeries?.currentMeasurement)
  throw new Error('Recorded Würzburg station has no water-level observation');
const pegelEvidence = provenance('pegel-main', 'snapshot', {
  sourceUrl: pegelCapture.url,
  fetchedAt: pegelCapture.fetchedAt,
  license: 'Datenlizenz Deutschland – Zero – Version 2.0',
  licenseUrl: 'https://www.govdata.de/dl-de/zero-2-0',
  attribution: 'Quelle: PEGELONLINE / Wasserstraßen- und Schifffahrtsverwaltung des Bundes',
});
// The licence must have been captured and reviewed before this manifest can be seeded.
const observation = gaugeSeries.currentMeasurement;
dataset(
  WATER_LEVEL_DATASET,
  'Main: Pegel Würzburg',
  'SmartCityMetric',
  [
    {
      id: station.uuid,
      label: `Main · ${station.longname}`,
      value: observation.value,
      unit: gaugeSeries.unit,
      observedAt: new Date(observation.timestamp).toISOString(),
      category: WATER_CATEGORY,
    },
  ],
  pegelEvidence,
);
dataset(
  'gauge-locations',
  'Pegel am Main',
  'GeoFeature',
  pegel.map((item) => ({
    id: item.uuid,
    name: item.longname,
    latitude: item.latitude,
    longitude: item.longitude,
    category: 'Pegel',
    description: 'Messstelle am Main; keine Hochwasserwarnung.',
    href: 'https://pegelonline.wsv.de/',
  })),
  pegelEvidence,
);
const history = await readJson('data/fixtures/pegel-wuerzburg-day/response.json');
const historyCapture = await readJson('data/fixtures/pegel-wuerzburg-day/response.meta.json');
dataset(
  'water-history',
  'Main: Wasserstand im Tagesverlauf',
  'SmartCityObservation',
  history.map((point) => ({
    id: `pegel-${point.timestamp}`,
    series: 'Main · Pegel Würzburg',
    observedAt: new Date(point.timestamp).toISOString(),
    value: point.value,
    unit: gaugeSeries.unit,
    category: WATER_CATEGORY,
  })),
  {
    ...pegelEvidence,
    sourceId: 'pegel-wuerzburg-day',
    sourceUrl: historyCapture.url,
    fetchedAt: historyCapture.fetchedAt,
  },
);

const civicManifest = await civicSite({
  schemaVersion: 1,
  websiteId: '3b0f6f2e-8a51-4c9d-9e27-5d1a7c4b2f80',
  epoch: EPOCH,
  website: {
    name: 'Würzburg · Stadt und Service',
    slug: 'wuerzburg',
    description: 'Bürgerservice und Stadtinformationen aus öffentlichen Quellen.',
    templateKey: 'municipal',
  },
  theme: {
    primaryColor: '#8F1838',
    secondaryColor: '#42554F',
    accentColor: '#A76521',
    headingFont: 'Source Serif 4',
    bodyFont: 'Inter',
    radius: 'md',
    spacingScale: 'comfortable',
  },
  stressBrands: [
    { name: 'light', primaryColor: '#FFFFE0' },
    { name: 'dark', primaryColor: '#080B14' },
    { name: 'saturated', primaryColor: '#FFFF00' },
  ],
  sources,
  datasets,
  pages: [],
  accounts: ['platform_admin', 'admin', 'editor', 'contributor', 'viewer', 'employee'].map(
    (role) => ({
      id: 'wuerzburg-demo-' + role,
      email: role + '@example.invalid',
      name: 'Prüfkonto ' + role,
      role,
      provenance: provenance('account:' + role),
    }),
  ),
  limitations: [],
});
await mkdir(new URL('data/seeds/', ROOT), { recursive: true });
// Expiry describes the configured refresh interval, not an assertion that a source observation is current.
const ingestionPolicy = await readJson('data/sources/wuerzburg.ingest.json');
for (const source of civicManifest.sources) {
  const policy = ingestionPolicy.sources.find(
    (item) => item.id === source.config.provenance.sourceId,
  );
  if (!policy) throw new Error(`Missing refresh policy for ${source.id}`);
  const evidence = {
    ...source.config.provenance,
    validUntil: new Date(
      Date.parse(source.config.provenance.fetchedAt) + policy.refreshSeconds * 1000,
    ).toISOString(),
  };
  source.config.provenance = evidence;
  source.config.records = source.config.records.map((record) => ({
    ...record,
    _provenance: evidence,
  }));
}
await writeFile(
  new URL('data/seeds/wuerzburg.json', ROOT),
  JSON.stringify(civicManifest, null, 2) + '\n',
);
process.stdout.write(
  'Prepared ' +
    civicManifest.pages.length +
    ' pages, ' +
    civicManifest.sources.length +
    ' real sources; SHA256 ' +
    createHash('sha256').update(JSON.stringify(civicManifest)).digest('hex') +
    '\n',
);
