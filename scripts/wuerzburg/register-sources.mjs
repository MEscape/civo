import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';

const NOT_VERIFIED = 'Not Verified';

const ROOT = new URL('../../', import.meta.url);
const FIXTURES = new URL('data/fixtures/', ROOT);
const json = async (path) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
const exists = async (path) => {
  try {
    await readFile(new URL(path, ROOT));
    return true;
  } catch {
    return false;
  }
};
const LFU_LICENSE = {
  license: 'Creative Commons Namensnennung 4.0 International (CC BY 4.0)',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
  attribution: 'Datenquelle: Bayerisches Landesamt für Umwelt, www.lfu.bayern.de',
};
const WMS_REASON =
  'Capabilities reviewed: license in <Fees>, EPSG:3857/4326 offered. Not connected: a browser GetMap request would be a third-party request, so a server-side proxy is required first.';
/** Reviewed on 2026-11-09 from the captured payloads; the generic rules below cannot tell. */
const REVIEWED = {
  'lfu-flood-wms': {
    ...LFU_LICENSE,
    licenseEvidence: 'data/fixtures/lfu-flood-wms/response.txt <Fees>',
    reason: WMS_REASON,
  },
  'lfu-noise-wms': {
    ...LFU_LICENSE,
    licenseEvidence: 'data/fixtures/lfu-noise-wms/response.txt <Fees>',
    reason: `${WMS_REASON} The layer describes the 2017 noise mapping round.`,
  },
  'bvv-dop-wms': {
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
    licenseEvidence: 'data/fixtures/bvv-dop-wms/response.txt <AccessConstraints>',
    reason: WMS_REASON,
  },
  'dwd-license': {
    license: 'CC BY 4.0 (CDC-OpenData area only, status May 2024)',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/deed.de',
    licenseEvidence: 'data/fixtures/dwd-license/response.pdf',
    reason: 'Terms text read: covers the CDC area, not /weather/.',
  },
  'dwd-weather-current': {
    reason:
      'Current hourly observations of station 10655 (Würzburg): semicolon CSV, comma decimals, `---` for missing, UTC time. Not published: /weather/ is outside the captured CDC terms and LIESMICH.txt defers to www.dwd.de/copyright, which robots.txt blocks for this probe.',
  },
  'nextbike-wuerzburg': {
    verdict: 'Skip (no nextbike system within 6 km of the city centre in the recorded response)',
    reason:
      'Response was {"countries":[]}. A bike-sharing availability component has no Würzburg evidence.',
  },
};
const captured = [];
for (const directory of await readdir(FIXTURES, { withFileTypes: true })) {
  if (!directory.isDirectory() || directory.name.startsWith('robots-')) continue;
  const relative = `data/fixtures/${directory.name}/response.meta.json`;
  if (!(await exists(relative))) continue;
  const meta = await json(relative);
  if (!(meta.httpStatus ?? meta.status)) continue;
  const status = meta.httpStatus ?? meta.status;
  const contentType = meta.contentType ?? meta.headers?.['content-type'] ?? null;
  const id = meta.id ?? directory.name;
  const files = await readdir(new URL(`${directory.name}/`, FIXTURES));
  // The sample the newest capture recorded wins over an older file left beside it (dwd-license: corrupted .txt, intact .pdf).
  const sampleFile =
    files.find((file) => file === meta.sample?.split('/').pop()) ??
    files.find((file) => /^response\.(json|html|txt|pdf)$/.test(file));
  let records = [];
  let catalog = null;
  if (sampleFile?.endsWith('.json')) {
    try {
      const body = await json(`data/fixtures/${directory.name}/${sampleFile}`);
      catalog = body['@type'] === 'Dataset' ? body : null;
      records = Array.isArray(body)
        ? body
        : catalog
          ? [catalog]
          : (body.results ?? body.records ?? body.features ?? []);
    } catch {
      /* Non-JSON error bodies do not count as schema samples. */
    }
  }
  const isPegel = ['pegel-main', 'pegel-wuerzburg-day'].includes(id);
  const isTownHall = id === 'wikidata-rathaus' && meta.projection !== undefined;
  const cityLicense = meta.license ?? catalog?.license ?? null;
  const reviewedCityLicense =
    typeof cityLicense === 'string' &&
    /\/(dl-by-de\/2\.0|cc-by\/4\.0|cc-by-sa\/4\.0)$/.test(cityLicense);
  const schema = [...new Set(records.slice(0, 3).flatMap((record) => Object.keys(record)))].map(
    (field) => ({
      field,
      presentInSample: records.slice(0, 3).filter((record) => Object.hasOwn(record, field)).length,
      sampleSize: Math.min(3, records.length),
      types: [
        ...new Set(
          records
            .slice(0, 3)
            .map((record) => (record[field] === null ? 'null' : typeof record[field])),
        ),
      ],
    }),
  );
  captured.push({
    id,
    name: meta.name ?? id,
    publisher: meta.publisher ?? (id.startsWith('wuerzburg') ? 'Stadt Würzburg' : NOT_VERIFIED),
    url: meta.url,
    accessType: /json/.test(contentType ?? '')
      ? 'REST/JSON'
      : /xml/.test(contentType ?? '')
        ? 'XML/OGC/document (review required)'
        : 'HTML/document',
    fetchedAt: meta.fetchedAt,
    httpStatus: status,
    contentType,
    auth: status === 200 ? 'No credential used in this probe' : NOT_VERIFIED,
    license: isPegel ? 'Datenlizenz Deutschland – Zero – Version 2.0' : cityLicense,
    licenseUrl: isPegel ? 'https://www.govdata.de/dl-de/zero-2-0' : cityLicense,
    licenseEvidence: isTownHall
      ? 'data/fixtures/wikidata-licensing/response.html'
      : isPegel
        ? 'data/fixtures/pegel-license/response.html'
        : reviewedCityLicense
          ? 'Captured catalog license URI and license-cc-by-4/license-cc-by-sa-4/license-dl-by-2 terms'
          : null,
    attribution: isTownHall
      ? 'Quelle: Wikidata · Rathaus Q98486869'
      : isPegel
        ? 'Quelle: PEGELONLINE / Wasserstraßen- und Schifffahrtsverwaltung des Bundes'
        : reviewedCityLicense
          ? 'Quelle: Stadt Würzburg  opendata.wuerzburg.de'
          : null,
    projection: meta.projection ?? null,
    robotsPolicy: meta.robotsPolicy ?? 'Earlier capture policy',
    distributions: catalog?.distribution ?? [],
    sourceKeywords: catalog?.keywords ?? [],
    sourceModified: catalog?.dateModified ?? null,
    cors: meta.headers?.['access-control-allow-origin'] ?? 'Not specified',
    cacheControl: meta.headers?.['cache-control'] ?? 'Not specified',
    rateLimits: {
      limit: meta.headers?.['x-ratelimit-limit'] ?? 'Not specified',
      remaining: meta.headers?.['x-ratelimit-remaining'] ?? null,
      reset: meta.headers?.['x-ratelimit-reset'] ?? null,
    },
    updateFrequency: isPegel
      ? 'Response timeseries.equidistance and actual observation timestamps; not guaranteed'
      : NOT_VERIFIED,
    responseBytes: meta.bytes ?? null,
    maxResponseBytes: 5_242_880,
    time: {
      granularity:
        id === 'pegel-wuerzburg-day' ? '5-minute timestamps observed; see records' : NOT_VERIFIED,
      historyDepth:
        id === 'pegel-wuerzburg-day'
          ? 'One requested day captured; longer windows Not Verified'
          : NOT_VERIFIED,
      timezone: isPegel
        ? 'Source ISO timestamps with offset; canonical records converted to UTC'
        : NOT_VERIFIED,
    },
    coverage: isTownHall
      ? 'Rathaus building, Würzburg; not an entrance or navigation route'
      : isPegel
        ? 'Main river; station Würzburg uuid 915d76e1-3bf9-4e37-9a9a-4d144cd771cc verified in station response'
        : NOT_VERIFIED,
    grouping:
      catalog !== null
        ? { type: 'Source keywords (dynamic)', values: catalog.keywords }
        : isPegel
          ? 'Named stations and source timeseries.shortname; no sustainability/mobility/energy enum'
          : NOT_VERIFIED,
    entityShapes:
      id === 'pegel-main'
        ? ['Place', 'Observation']
        : id === 'pegel-wuerzburg-day'
          ? ['Series', 'Observation']
          : (meta.entityShapes ?? ['Document']),
    sample: sampleFile ? `data/fixtures/${directory.name}/${sampleFile}` : null,
    sampleRecords: records.slice(0, 3),
    schema,
    quirks: isPegel
      ? [
          'Water level unit cm is relative to gauge zero, not sea level',
          'Characteristic values are not municipal warning stages',
          'Validate null/missing measurements; never infer zero',
        ]
      : [
          'HTTP 200 alone does not prove a usable data API',
          'Reuse license and actual record schema require review',
        ],
    reliability: 'One recorded response; longitudinal availability Not Verified',
    verdict:
      (isPegel ||
        isTownHall ||
        catalog !== null ||
        (/^city-(window|complete)-/.test(id) && reviewedCityLicense)) &&
      status === 200
        ? 'Snapshot only'
        : NOT_VERIFIED,
    reason: isTownHall
      ? 'One allowlisted building record; CC0 structured-data policy captured and read; mapped to the contact-page location'
      : isPegel
        ? 'Reviewed keyless response and license; dated snapshot with a bounded operator refresh policy.'
        : catalog !== null
          ? 'Verified catalog metadata and distribution links; record ingestion is a separate decision'
          : /^city-(window|complete)-/.test(id) && reviewedCityLicense
            ? 'Bounded records and reviewed license captured; mapped snapshots are identified in the seed manifest'
            : (meta.reason ?? 'Captured response, but not approved for data binding'),
    ...REVIEWED[id],
  });
}
const sitemap = await readFile(
  new URL('data/fixtures/wuerzburg-sitemap/response.txt', ROOT),
  'utf8',
);
const cityLeads = [
  ...sitemap.matchAll(
    /<url><loc>([^<]*\/explore\/assets\/[^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g,
  ),
].map((match) => ({
  url: match[1],
  datasetId: match[1].split('/').filter(Boolean).at(-1),
  modified: match[2],
  verification: captured.some((source) => source.url === match[1] && source.httpStatus === 200)
    ? 'Metadata verified'
    : NOT_VERIFIED,
  reason:
    'Consult captured metadata and distributions. Catalog verification does not prove full record ingestion.',
}));
const vocabulary = [
  'Series',
  'Observation',
  'Feature',
  'Place',
  'Event',
  'Notice',
  'Document',
  'Dataset',
  'Person/Body',
  'Service',
  'Schedule',
  'Aggregate',
];
const candidates = await json('data/fixtures/discovery/candidates.json');
const capturedUrls = new Set(captured.map((source) => source.url));
const unverifiedDiscoveryLeads = candidates.sources.filter(
  (source) => !capturedUrls.has(source.url),
);
const register = {
  schemaVersion: 1,
  capturedAt: new Date().toISOString(),
  entityShapeVocabulary: vocabulary,
  policy: {
    robots: 'data/fixtures/wuerzburg-robots/response.txt',
    terms: 'data/fixtures/wuerzburg-terms/response.html',
    noPersonalData: 'Only fictional contacts in the city seed; no real council members copied',
    status:
      'Catalog metadata enumerated; bounded city records captured; no blanket live-source claim',
    robotsOverride:
      'User explicitly allowed public API probes despite advisory robots on 2026-11-06; access controls and source terms remain in force',
  },
  sources: captured,
  unverifiedDiscoveryLeads,
  cityCatalogEntries: cityLeads,
  unverifiedCityCatalogLeads: cityLeads.filter((item) => item.verification === NOT_VERIFIED),
};
await mkdir(new URL('data/sources/', ROOT), { recursive: true });
await writeFile(
  new URL('data/sources/wuerzburg.sources.json', ROOT),
  `${JSON.stringify(register, null, 2)}\n`,
);
const escape = (value) =>
  String(value ?? NOT_VERIFIED)
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
const rows = captured.map(
  (source) =>
    `| ${escape(source.id)} | ${source.httpStatus} | ${escape(source.contentType)} | ${escape(source.entityShapes.join(', '))} | ${source.verdict} | [capture](../../${source.sample ?? 'data/sources/wuerzburg.sources.json'}) |`,
);
await writeFile(
  new URL('docs/würzburg/01-data-source-register.md', ROOT),
  `# M1: recorded source register\n\nCaptured ${captured.length} actual HTTP responses and enumerated ${cityLeads.length} catalog metadata entries. The machine-readable register contains exact URLs, dates, headers, samples, field presence, license evidence and unresolved questions.\n\nAll 185 catalog pages were fetched. Their Dataset JSON-LD supplies license URIs, dynamic keywords and distribution links. Bounded record requests now cover districts, trees, cycling, toilets, climate sensors, parking and waste. The user explicitly allowed public API probes despite advisory robots rules. Complete bicycle-place and waste exports are captured. Bounded snapshot ingestion and a separate refresh worker are implemented; a monitored deployment schedule remains unverified.\n\nPEGELONLINE license was read in its linked [terms](https://pegelonline.wsv.de/gast/nutzungsbedingungen). The Main station response contains Würzburg and cm water levels; its requested one-day history was captured. Both are used as dated snapshots. No live integration is claimed.\n\n| Source | HTTP | Content type | Shape | Verdict | Evidence |\n| --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\n## Interpretation limits\n\n- Source keywords and distribution formats come from captured metadata. Required record fields and units still require payload-level evidence.\n- Open Data Bayern's candidate CKAN-style endpoint returned HTML with HTTP 200. It is not a verified CKAN integration.\n- NINA returned an empty JSON array. This verifies an empty response, not a warning-item schema or a continuous absence of warnings.\n- Candidate OGC URLs returned errors or capabilities documents. A capabilities response alone does not establish a licensed, working spatial layer.\n- Unreadable, blocked, redirected, unlicensed and untested sources remain Not Verified.\n- 2026-11-09 data-endpoint probes: robots.txt disallowed Overpass, DWD warnings, GovData CKAN and the council system's OParl path, so no request was sent (see each \`attempt.meta.json\`). The MaStR robots policy could not be verified, so no request was sent. UBA air-data stations returned HTTP 500 twice. These stay Not Verified; no robots override was used for them.
- Probe scripts use bounded requests and one-second pacing. The explicit --ignore-robots option records the user-authorized advisory override. No browser data requests are needed for snapshots.\n`,
);
// Data findings are reviewed analysis; refreshes must not overwrite that document.
process.stdout.write(
  `Registered ${captured.length} fetched responses; ${cityLeads.length} city metadata entries enumerated.\n`,
);
