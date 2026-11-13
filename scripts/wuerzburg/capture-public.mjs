import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { setTimeout } from 'node:timers';
import { URL, URLSearchParams } from 'node:url';
import { promisify } from 'node:util';

import { projectPublicHtml, projectWikidataPlace } from './catalog-projection.mjs';

const CITY_PUBLISHER = 'Stadt Würzburg';
const WSV_PUBLISHER = 'Wasserstraßen- und Schifffahrtsverwaltung des Bundes';
const DWD_PUBLISHER = 'Deutscher Wetterdienst';
const NOT_VERIFIED = 'Not Verified';

const ROOT = new URL('../../', import.meta.url);
const execute = promisify(execFile);
const MAX_BYTES = 5 * 1024 * 1024;
const PAUSE_MS = 1_000;
const responses = [];
const domains = new Map();
const USER_AGENT = 'CivoReferenceCity/1.0';
const IGNORE_ROBOTS = process.argv.includes('--ignore-robots');
const OSM_QUERY =
  '[out:json][timeout:20];(node[amenity=drinking_water](49.75,9.88,49.83,10.02);node[amenity=toilets](49.75,9.88,49.83,10.02);node[emergency=defibrillator](49.75,9.88,49.83,10.02);way[highway=cycleway](49.75,9.88,49.83,10.02);way[leisure=park](49.75,9.88,49.83,10.02););out body geom 120;';
const SOURCES = [
  [
    'wikidata-rathaus',
    'https://www.wikidata.org/wiki/Special:EntityData/Q98486869.json',
    'Place',
    'Wikidata contributors',
    'https://creativecommons.org/publicdomain/zero/1.0/',
  ],
  [
    'wikidata-licensing',
    'https://www.wikidata.org/wiki/Wikidata:Licensing',
    'Document',
    'Wikimedia Foundation',
    null,
  ],
  [
    'city-service-info',
    'https://www.wuerzburg.de/rathaus/buergerbuero/allgemeine-informationen-zum-buergerbuero',
    'Service',
    CITY_PUBLISHER,
    null,
  ],
  [
    'city-service-home',
    'https://www.wuerzburg.de/rathaus/buergerbuero/index.html',
    'Service',
    CITY_PUBLISHER,
    null,
  ],
  [
    'city-service-residence',
    'https://www.wuerzburg.de/rathaus/buergerbuero/meldewesen/index.html',
    'Service',
    CITY_PUBLISHER,
    null,
  ],
  [
    'license-cc-by-4',
    'https://creativecommons.org/licenses/by/4.0/deed.de',
    'Document',
    'Creative Commons',
    null,
  ],
  [
    'license-cc-by-sa-4',
    'https://creativecommons.org/licenses/by-sa/4.0/deed.de',
    'Document',
    'Creative Commons',
    null,
  ],
  ['license-dl-by-2', 'https://www.govdata.de/dl-de/by-2-0', 'Document', 'GovData', null],
  [
    'wuerzburg-tree-catalog',
    'https://opendata.wuerzburg.de/explore/assets/baumkataster_stadt_wuerzburg/',
    'Dataset',
    CITY_PUBLISHER,
    null,
  ],
  [
    'osm-copyright',
    'https://www.openstreetmap.org/copyright',
    'Document',
    'OpenStreetMap contributors',
    null,
  ],
  [
    'osm-wuerzburg-features',
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(OSM_QUERY)}`,
    'Feature',
    'OpenStreetMap contributors',
    null,
  ],
  [
    'pegel-docs-canonical',
    'https://pegelonline.wsv.de/webservice/dokuRestapi',
    'Document',
    WSV_PUBLISHER,
    null,
  ],
  [
    'pegel-terms-canonical',
    'https://pegelonline.wsv.de/webservice/ueber',
    'Document',
    WSV_PUBLISHER,
    null,
  ],
  [
    'pegel-license',
    'https://pegelonline.wsv.de/gast/nutzungsbedingungen',
    'Document',
    WSV_PUBLISHER,
    null,
  ],
  [
    'dwd-license',
    'https://opendata.dwd.de/climate_environment/CDC/Terms_of_use.pdf',
    'Document',
    DWD_PUBLISHER,
    null,
  ],
  [
    'energy-charts-openapi',
    'https://api.energy-charts.info/openapi.json',
    'Document',
    'Fraunhofer ISE',
    null,
  ],
  ['energy-charts-docs', 'https://api.energy-charts.info/', 'Document', 'Fraunhofer ISE', null],
  [
    'uba-stations-canonical',
    'https://luftdaten.umweltbundesamt.de/api/air-data/v3/stations/json?use=airquality',
    'Place',
    'Umweltbundesamt',
    null,
  ],
  [
    'dwd-stations-recent',
    'https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/hourly/air_temperature/recent/TU_Stundenwerte_Beschreibung_Stationen.txt',
    'Place',
    DWD_PUBLISHER,
    null,
  ],
  [
    'dwd-weather-current',
    'https://opendata.dwd.de/weather/weather_reports/poi/10655-BEOB.csv',
    'Observation',
    DWD_PUBLISHER,
    null,
  ],
  [
    'wuerzburg-trees-page',
    'https://opendata.wuerzburg.de/explore/assets/baumkataster/',
    'Feature',
    CITY_PUBLISHER,
    null,
  ],
  [
    'wuerzburg-sitemap',
    'https://opendata.wuerzburg.de/sitemap.xml',
    'Dataset',
    CITY_PUBLISHER,
    null,
  ],
  [
    'wuerzburg-catalog-html',
    'https://opendata.wuerzburg.de/explore/',
    'Dataset',
    CITY_PUBLISHER,
    null,
  ],
  [
    'wuerzburg-terms',
    'https://opendata.wuerzburg.de/terms/terms-and-conditions/',
    'Document',
    CITY_PUBLISHER,
    null,
  ],
  [
    'pegel-docs',
    'https://www.pegelonline.wsv.de/webservice/dokuRestapi',
    'Document',
    WSV_PUBLISHER,
    null,
  ],
  [
    'pegel-terms',
    'https://www.pegelonline.wsv.de/webservice/ueber',
    'Document',
    WSV_PUBLISHER,
    null,
  ],
  [
    'pegel-main',
    'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json?waters=MAIN&includeTimeseries=true&includeCurrentMeasurement=true&includeCharacteristicValues=true',
    'Observation',
    WSV_PUBLISHER,
    null,
  ],
  [
    'dwd-terms',
    'https://www.dwd.de/DE/service/rechtliche_hinweise/rechtliche_hinweise.html',
    'Document',
    DWD_PUBLISHER,
    null,
  ],
  [
    'dwd-warnings',
    'https://www.dwd.de/DWD/warnungen/warnapp/json/warnings.json',
    'Notice',
    DWD_PUBLISHER,
    null,
  ],
  [
    'dwd-stations',
    'https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/hourly/air_temperature/TU_Stundenwerte_Beschreibung_Stationen.txt',
    'Place',
    DWD_PUBLISHER,
    null,
  ],
  [
    'uba-docs',
    'https://www.umweltbundesamt.de/daten/luft/luftdaten/doc',
    'Document',
    'Umweltbundesamt',
    null,
  ],
  [
    'uba-stations',
    'https://www.umweltbundesamt.de/api/air_data/v3/stations/json?use=airquality',
    'Place',
    'Umweltbundesamt',
    null,
  ],
  [
    'nina-terms',
    'https://warnung.bund.de/api/appdata/gsb/html/DE/app/impressum.html',
    'Document',
    'Bundesamt für Bevölkerungsschutz und Katastrophenhilfe',
    null,
  ],
  [
    'nina-wuerzburg',
    'https://warnung.bund.de/api31/dashboard/096630000000.json',
    'Notice',
    'Bundesamt für Bevölkerungsschutz und Katastrophenhilfe',
    null,
  ],
  [
    'bydata-catalog',
    'https://open.bydata.de/api/3/action/package_search?q=W%C3%BCrzburg&rows=100',
    'Dataset',
    'Bayerisches Staatsministerium für Digitales',
    null,
  ],
  [
    'bayern-geodata',
    'https://geoservices.bayern.de/wms/v2/ogc_dop80_oa.cgi?SERVICE=WMS&REQUEST=GetCapabilities',
    'Feature',
    'Bayerische Vermessungsverwaltung',
    null,
  ],
  [
    'bayern-boundaries',
    'https://geoservices.bayern.de/wfs/v2/ogc_verwaltungs_einheiten.cgi?SERVICE=WFS&REQUEST=GetCapabilities',
    'Feature',
    'Bayerische Vermessungsverwaltung',
    null,
  ],
  [
    'bayern-hydrology',
    'https://www.gkd.bayern.de/de/fluesse/wasserstand/main_unten',
    'Observation',
    'Bayerisches Landesamt für Umwelt',
    null,
  ],
  [
    'bayern-statistics',
    'https://www.statistikdaten.bayern.de/genesis/online',
    'Aggregate',
    'Bayerisches Landesamt für Statistik',
    null,
  ],
  [
    'regionalstatistik',
    'https://www.regionalstatistik.de/genesis/online',
    'Aggregate',
    'Statistische Ämter des Bundes und der Länder',
    null,
  ],
  [
    'zensus2022',
    'https://www.zensus2022.de/DE/Ergebnisse-des-Zensus/_inhalt.html',
    'Aggregate',
    'Statistische Ämter des Bundes und der Länder',
    null,
  ],
  [
    'govdata-catalog',
    'https://www.govdata.de/ckan/api/3/action/package_search?q=W%C3%BCrzburg&rows=100',
    'Dataset',
    'FITKO',
    null,
  ],
  [
    'europa-catalog',
    'https://data.europa.eu/api/hub/search/search?query=W%C3%BCrzburg&limit=3',
    'Dataset',
    'Publications Office of the European Union',
    null,
  ],
  [
    'mastR',
    'https://www.marktstammdatenregister.de/MaStR/Datendownload',
    'Dataset',
    'Bundesnetzagentur',
    null,
  ],
  [
    'smard-docs',
    'https://www.smard.de/home/downloadcenter/download-marktdaten/',
    'Series',
    'Bundesnetzagentur',
    null,
  ],
  [
    'energy-charts',
    'https://api.energy-charts.info/public_power?country=de&start=2026-11-01&end=2026-11-02',
    'Series',
    'Fraunhofer ISE',
    null,
  ],
  [
    'mobilithek',
    'https://mobilithek.info/offers',
    'Dataset',
    'Bundesministerium für Verkehr',
    null,
  ],
  ['delfi', 'https://www.opendata-oepnv.de/', 'Schedule', 'DELFI', null],
  [
    'wvv',
    'https://www.wvv.de/mobilitaet/',
    'Schedule',
    'Würzburger Versorgungs- und Verkehrs-GmbH',
    null,
  ],
  ['vvm', 'https://www.vvm-info.de/', 'Schedule', 'Verkehrsverbund Mainfranken', null],
  [
    'wuerzburg-ris',
    'https://www.wuerzburg.sitzung-online.de/',
    'Person/Body',
    CITY_PUBLISHER,
    null,
  ],
  ['wuerzburg-city', 'https://www.wuerzburg.de/', 'Service', CITY_PUBLISHER, null],
  [
    'wuerzburg-library',
    'https://www.wuerzburg.de/stadtbuecherei/',
    'Schedule',
    CITY_PUBLISHER,
    null,
  ],
  [
    'osm-policy',
    'https://operations.osmfoundation.org/policies/tiles/',
    'Document',
    'OpenStreetMap Foundation',
    null,
  ],
  [
    'nominatim-policy',
    'https://operations.osmfoundation.org/policies/nominatim/',
    'Document',
    'OpenStreetMap Foundation',
    null,
  ],
  [
    'overpass-docs',
    'https://wiki.openstreetmap.org/wiki/Overpass_API',
    'Document',
    'OpenStreetMap contributors',
    null,
  ],
  [
    'nextbike-discovery',
    'https://gbfs.nextbike.net/maps/gbfs/v2/nextbike_de/gbfs.json',
    'Place',
    'nextbike',
    null,
  ],
  [
    'bkg-basemap',
    'https://sgx.geodatenzentrum.de/wms_basemapde?SERVICE=WMS&REQUEST=GetCapabilities',
    'Feature',
    'Bundesamt für Kartographie und Geodäsie',
    null,
  ],
  [
    'copernicus',
    'https://land.copernicus.eu/en/products/urban-atlas',
    'Feature',
    'European Environment Agency',
    null,
  ],
  // 2026-11-09 leads: data endpoints, not documentation pages. Each stays Not Verified until reviewed.
  ['dwd-opendata-index', 'https://opendata.dwd.de/', 'Document', DWD_PUBLISHER, null],
  [
    'dwd-opendata-liesmich',
    'https://opendata.dwd.de/LIESMICH.txt',
    'Document',
    DWD_PUBLISHER,
    null,
  ],
  [
    'dwd-poi-index',
    'https://opendata.dwd.de/weather/weather_reports/poi/',
    'Dataset',
    DWD_PUBLISHER,
    null,
  ],
  [
    'oparl-sitzung-online',
    'https://www.wuerzburg.sitzung-online.de/public/oparl/system',
    'Person/Body',
    CITY_PUBLISHER,
    null,
  ],
  [
    'nextbike-wuerzburg',
    'https://maps.nextbike.net/maps/nextbike-live.json?lat=49.7913&lng=9.9534&distance=6000&limit=10',
    'Place',
    'nextbike GmbH',
    null,
  ],
  [
    'lfu-flood-wms',
    'https://www.lfu.bayern.de/gdi/wms/wasser/ueberschwemmungsgebiete?SERVICE=WMS&REQUEST=GetCapabilities',
    'Feature',
    'Bayerisches Landesamt für Umwelt',
    null,
  ],
  [
    'lfu-noise-wms',
    'https://www.lfu.bayern.de/gdi/wms/laerm/hauptverkehrsstrassen?SERVICE=WMS&REQUEST=GetCapabilities',
    'Feature',
    'Bayerisches Landesamt für Umwelt',
    null,
  ],
  [
    'bvv-dop-wms',
    'https://geoservices.bayern.de/od/wms/dop/v1/dop20?SERVICE=WMS&REQUEST=GetCapabilities',
    'Feature',
    'Bayerische Vermessungsverwaltung',
    null,
  ],
  [
    'mastr-wuerzburg-units',
    "https://www.marktstammdatenregister.de/MaStR/Einheit/EinheitJson/GetErweiterteOeffentlicheEinheitStromerzeugung?sort=&page=1&pageSize=10&group=&filter=Gemeindeschl%C3%BCssel~eq~'09663000'",
    'Aggregate',
    'Bundesnetzagentur',
    null,
  ],
];
const pegelStations = JSON.parse(
  await readFile(new URL('data/fixtures/pegel-main/response.json', ROOT), 'utf8'),
);
const localGauge = pegelStations.find((station) => station.longname === 'WÜRZBURG');
if (localGauge)
  SOURCES.push([
    'pegel-wuerzburg-day',
    `https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/${localGauge.uuid}/W/measurements.json?start=P1D`,
    'Series',
    WSV_PUBLISHER,
    null,
  ]);

if (process.argv.includes('--city-catalog')) {
  const sitemap = await readFile(
    new URL('data/fixtures/wuerzburg-sitemap/response.txt', ROOT),
    'utf8',
  );
  for (const match of sitemap.matchAll(
    /<loc>(https:\/\/opendata\.wuerzburg\.de\/explore\/assets\/([^<]+)\/)<\/loc>/g,
  )) {
    if (!/^[a-z0-9_-]{1,200}$/i.test(match[2])) continue;
    const url = new URL(match[1]);
    if (url.origin !== 'https://opendata.wuerzburg.de' || url.search || url.hash) continue;
    SOURCES.push([`city-asset-${match[2]}`, url.toString(), 'Dataset', CITY_PUBLISHER, null]);
  }
}

// Dataset identifiers are taken from captured catalog entries, never guessed.
if (process.argv.includes('--city-records')) {
  const datasetIds = [
    'baumkataster_stadt_wuerzburg',
    'stadtbezirke',
    'barrierefreie-toiletten-im-stadtgebiet-wuerzburg',
    'fahrradstellplaetze-stadt-wuerzburg',
    'bicycle_counter_sites',
    'fahrradzaehlung-tagesdaten-alle-zaehlstationen',
    'parkplatzdaten_wuerzburg',
    'stadtbezirke_hauptwohnsitz',
    'wetterstation-ludwigkai',
    'abfallkalender-wuerzburg',
    'eventfeed',
    'klimabaeume-locations',
    'passantenzaehlung_tagesdaten',
    'pedestrians_counter_geojson',
    'bevoelkerungsstand',
    'altersstruktur',
    'arbeitsmarkt',
    'kfz',
    'flaeche',
    'stadtbezirke_durchschnittsalter',
  ];
  for (const datasetId of datasetIds) {
    const catalog = JSON.parse(
      await readFile(new URL(`data/fixtures/city-asset-${datasetId}/response.json`, ROOT), 'utf8'),
    );
    if (
      catalog['@type'] !== 'Dataset' ||
      !catalog.distribution?.some((item) => item.contentUrl.includes(`/datasets/${datasetId}/`))
    )
      throw new Error(`No captured distribution for ${datasetId}`);
    SOURCES.push([
      `city-records-${datasetId}`,
      `https://opendata.wuerzburg.de/api/explore/v2.1/catalog/datasets/${datasetId}/records?${new URLSearchParams({ limit: '3', ...(datasetId === 'barrierefreie-toiletten-im-stadtgebiet-wuerzburg' ? { select: 'id,company,toilettype,geometry' } : {}) })}`,
      'Feature',
      CITY_PUBLISHER,
      catalog.license,
    ]);
    // The portal's own field list: labels, types and units that the records do not carry.
    SOURCES.push([
      `city-meta-${datasetId}`,
      `https://opendata.wuerzburg.de/api/explore/v2.1/catalog/datasets/${datasetId}`,
      'Dataset',
      CITY_PUBLISHER,
      catalog.license,
    ]);
  }
  if (process.argv.includes('--windows')) {
    const windows = [
      ['stadtbezirke', { limit: '100', select: 'name,geometry' }],
      ['bicycle_counter_sites', { limit: '100', select: 'id,name,location,granularity' }],
      [
        'fahrradstellplaetze-stadt-wuerzburg',
        { limit: '100', select: 'id,title,geo_point_2d,categories_name', order_by: 'title' },
      ],
      [
        'barrierefreie-toiletten-im-stadtgebiet-wuerzburg',
        { limit: '100', select: 'id,company,toilettype,geometry' },
      ],
      ['klimabaeume-locations', { limit: '100', select: 'id,lage,baumart,geo_point_2d' }],
      ['stadtbezirke_hauptwohnsitz', { limit: '100', order_by: 'jahr DESC,stadtbezirk' }],
      ['parkplatzdaten_wuerzburg', { limit: '100', order_by: 'values_from DESC' }],
      [
        'fahrradzaehlung-tagesdaten-alle-zaehlstationen',
        { limit: '100', order_by: 'dayofyear DESC,name' },
      ],
      ['wetterstation-ludwigkai', { limit: '100', order_by: 'zeit DESC' }],
      [
        'abfallkalender-wuerzburg',
        {
          limit: '100',
          select: 'id,titel,kategorie,start,kurztext,stadtteil_name',
          order_by: 'start,stadtteil_name',
        },
      ],
      [
        'baumkataster_stadt_wuerzburg',
        {
          limit: '100',
          select: 'source_id,baumart,baumart_la,baumtyp,geo_punkt',
          order_by: 'source_id',
        },
      ],
    ];
    for (const [datasetId, query] of windows) {
      const catalog = JSON.parse(
        await readFile(
          new URL(`data/fixtures/city-asset-${datasetId}/response.json`, ROOT),
          'utf8',
        ),
      );
      SOURCES.push([
        `city-window-${datasetId}`,
        `https://opendata.wuerzburg.de/api/explore/v2.1/catalog/datasets/${datasetId}/records?${new URLSearchParams(query)}`,
        'Feature',
        CITY_PUBLISHER,
        catalog.license,
      ]);
    }
  }
}

if (process.argv.includes('--complete')) {
  for (const [datasetId, select] of [
    ['fahrradstellplaetze-stadt-wuerzburg', 'id,title,geo_point_2d,categories_name'],
    ['abfallkalender-wuerzburg', 'id,titel,kategorie,start,kurztext,stadtteil_name'],
  ]) {
    const catalog = JSON.parse(
      await readFile(new URL(`data/fixtures/city-asset-${datasetId}/response.json`, ROOT), 'utf8'),
    );
    const download = catalog.distribution.find((item) => item.encodingFormat === 'JSON');
    if (!download) throw new Error(`Missing verified JSON distribution for ${datasetId}`);
    const target = new URL(download.contentUrl);
    if (target.origin !== 'https://opendata.wuerzburg.de')
      throw new Error('Unreviewed export origin');
    target.searchParams.set('select', select);
    SOURCES.push([
      `city-complete-${datasetId}`,
      target.toString(),
      'Feature',
      CITY_PUBLISHER,
      catalog.license,
    ]);
  }
}

const WEEKDAY_LINE = /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag)\s/;

/**
 * Plain facts of a civic-service page. Opening hours, closing days and payment
 * methods are facts, not article text; mailboxes are kept only when they are
 * functional city addresses, never a person's.
 */
function civicFacts(html) {
  const main = /<main[\s\S]*?<\/main>/i.exec(html)?.[0] ?? '';
  const lines = main
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const after = (start, keep) => {
    const index = lines.findIndex(start);
    if (index === -1) return [];
    const rest = lines.slice(index + 1);
    const end = rest.findIndex((line) => !keep(line));
    return end === -1 ? rest : rest.slice(0, end);
  };
  const openingHours = lines.flatMap((line, index) =>
    /^Öffnungszeiten (des|für) /.test(line) && !line.endsWith(':')
      ? [
          {
            desk: line,
            days: lines
              .slice(index + 1, index + 12)
              .filter((day) => WEEKDAY_LINE.test(day))
              .slice(0, 7),
          },
        ]
      : [],
  );
  return {
    openingHours: openingHours.filter((desk) => desk.days.length > 0),
    closedOn: after(
      (line) => line.endsWith('geschlossen an...'),
      (line) => !line.startsWith('Sonstige'),
    ),
    questions: [...new Set(lines.filter((line) => line.endsWith('?') && line.length < 160))],
    payment: after(
      (line) => line.endsWith('Ihre Zahlungen zu tätigen:'),
      (line) => /^(bar|mit Karte|per Smartphone)/.test(line),
    ),
    mailboxes: [
      ...new Set(
        [
          ...main.matchAll(/\b(gewerbemeldung|meldewesen|buergerbuero)@stadt\.wuerzburg\.de\b/g),
        ].map((match) => match[0]),
      ),
    ],
  };
}

async function save(id, name, value) {
  const directory = new URL(`data/fixtures/${id}/`, ROOT);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL(name, directory),
    typeof value === 'string' || Buffer.isBuffer(value)
      ? value
      : `${JSON.stringify(value, null, 2)}\n`,
  );
}

/** Headers are ASCII; latin1 maps every byte to one char, so offsets into it are byte offsets. */
function parseWire(stdout) {
  const wire = stdout.toString('latin1');
  let offset = 0;
  let header = '';
  while (wire.startsWith('HTTP/', offset)) {
    const match = /\r?\n\r?\n/.exec(wire.slice(offset));
    if (!match) throw new Error('HTTP header boundary missing');
    header = wire.slice(offset, offset + match.index);
    offset += match.index + match[0].length;
  }
  const lines = header.split(/\r?\n/);
  const status = Number(lines.shift()?.split(' ')[1]);
  const headers = Object.fromEntries(
    lines
      .flatMap((line) => {
        const colon = line.indexOf(':');
        return colon < 0
          ? []
          : [[line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim()]];
      })
      .filter(([key]) => !['set-cookie', 'cookie'].includes(key)),
  );
  // Binary payloads (PDF terms) must keep their bytes; `body` is the text view.
  const bytes = stdout.subarray(offset);
  return { status, headers, body: bytes.toString('utf8'), bytes };
}

async function fetchPublic(url) {
  const { stdout } = await execute(
    process.platform === 'win32' ? 'curl.exe' : 'curl',
    [
      '--silent',
      '--show-error',
      '--max-time',
      '20',
      '--max-filesize',
      String(MAX_BYTES),
      '--include',
      '--user-agent',
      USER_AGENT,
      url,
    ],
    { maxBuffer: MAX_BYTES + 100_000, timeout: 25_000, encoding: 'buffer' },
  );
  return parseWire(stdout);
}

/** Uses only the matching generic-agent group; never impersonates a crawler with broader permissions. */
function isAllowed(text, pathname) {
  let agents = [];
  let hadRule = false;
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const [name, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (name?.toLowerCase() === 'user-agent') {
      if (hadRule) {
        agents = [];
        hadRule = false;
      }
      agents.push(value.toLowerCase());
    } else if (['allow', 'disallow'].includes(name?.toLowerCase())) {
      hadRule = true;
      if (agents.includes('*') && value)
        rules.push({ value, allow: name.toLowerCase() === 'allow' });
    }
  }
  const matches = rules
    .filter(({ value }) => {
      const escaped = value.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
      return new RegExp(`^${escaped}`).test(pathname);
    })
    .sort((a, b) => b.value.length - a.value.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}

async function robotsFor(origin) {
  if (domains.has(origin)) return domains.get(origin);
  const url = `${origin}/robots.txt`;
  try {
    const response = await fetchPublic(url);
    const id = `robots-${new URL(origin).hostname.replaceAll('.', '-')}`;
    await save(id, 'response.txt', response.body);
    await save(id, 'response.meta.json', {
      url,
      status: response.status,
      headers: response.headers,
      fetchedAt: new Date().toISOString(),
    });
    const policy = {
      text: response.status === 200 ? response.body : '',
      verified: [200, 404].includes(response.status),
      url,
    };
    domains.set(origin, policy);
    return policy;
  } catch {
    const policy = { text: '', verified: false, url };
    domains.set(origin, policy);
    return policy;
  }
}

const selected = process.argv
  .find((argument) => argument.startsWith('--ids='))
  ?.slice(6)
  .split(',');
await save('discovery', 'candidates.json', {
  schemaVersion: 1,
  sources: SOURCES.map(([id, url, entityShape, publisher]) => ({
    id,
    url,
    publisher,
    entityShapes: [entityShape],
    verification: NOT_VERIFIED,
    reason: 'Discovery candidate only; consult capture metadata for actual request evidence',
  })),
});
if (process.argv.includes('--list-only')) {
  process.stdout.write(`Listed ${SOURCES.length} candidates without network requests.\n`);
  process.exit(0);
}
for (const [id, url, entityShape, publisher, license] of SOURCES.filter(([id]) =>
  selected === undefined
    ? process.argv.includes('--complete')
      ? id.startsWith('city-complete-')
      : process.argv.includes('--windows')
        ? id.startsWith('city-window-')
        : process.argv.includes('--city-records')
          ? id.startsWith('city-records-')
          : !process.argv.includes('--city-catalog') || id.startsWith('city-asset-')
    : selected.includes(id),
)) {
  const target = new URL(url);
  const policy = await robotsFor(target.origin);
  const record = {
    id,
    name: id,
    publisher,
    url,
    entityShapes: [entityShape],
    auth: NOT_VERIFIED,
    license,
    attribution: null,
    fetchedAt: new Date().toISOString(),
    httpStatus: null,
    contentType: null,
    sample: null,
    verdict: NOT_VERIFIED,
    reason: '',
    robots: policy.url,
    robotsPolicy: IGNORE_ROBOTS
      ? 'Advisory rules recorded; explicit user instruction permits public API probes'
      : 'Respect generic-agent rules',
    grouping: NOT_VERIFIED,
    time: { granularity: NOT_VERIFIED, historyDepth: NOT_VERIFIED },
    reliability: 'Single probe; sustained availability Not Verified',
  };
  if (!IGNORE_ROBOTS && (!policy.verified || !isAllowed(policy.text, target.pathname))) {
    record.reason = policy.verified
      ? 'robots.txt disallows this path; request not sent'
      : 'Robots policy could not be verified; request not sent';
  } else {
    try {
      const response = await fetchPublic(url);
      Object.assign(record, {
        httpStatus: response.status,
        contentType: response.headers['content-type'] ?? null,
        headers: response.headers,
        bytes: response.bytes.length,
        sha256: createHash('sha256').update(response.bytes).digest('hex'),
      });
      if (response.status >= 300 && response.status < 400) {
        record.reason = `Redirect requires separate robots review: ${response.headers.location ?? 'unknown'}`;
      } else if (response.status !== 200) {
        record.reason = `HTTP ${response.status}`;
      } else {
        // Personal-directory payloads remain memory-only. Geographic, aggregate and policy captures are safe fixtures.
        const maySave = ![
          'wuerzburg-city',
          'wuerzburg-ris',
          'wuerzburg-library',
          'vvm',
          'wvv',
        ].includes(id);
        if (maySave) {
          const projection =
            id === 'wikidata-rathaus'
              ? projectWikidataPlace(response.body)
              : id.startsWith('city-service-')
                ? {
                    body:
                      JSON.stringify(
                        {
                          title:
                            /<title[^>]*>([\s\S]*?)<\/title>/i.exec(response.body)?.[1]?.trim() ??
                            '',
                          links: [
                            ...response.body.matchAll(
                              /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
                            ),
                          ]
                            .flatMap((match) => {
                              const label = match[2]
                                .replace(/<[^>]*>/g, '')
                                .replace(/\s+/g, ' ')
                                .trim();
                              if (
                                !/Termin|Meldewesen|Personalausweis|Reisepass|Wohnsitz|Online-Service|Serviceleistungen|Öffnungszeiten/.test(
                                  label,
                                ) ||
                                label.length > 150
                              )
                                return [];
                              try {
                                const link = new URL(match[1].replaceAll('&amp;', '&'), url);
                                return link.protocol === 'https:'
                                  ? [{ label, url: link.toString() }]
                                  : [];
                              } catch {
                                return [];
                              }
                            })
                            .slice(0, 60),
                          facts: civicFacts(response.body),
                        },
                        null,
                        2,
                      ) + '\n',
                    extension: 'json',
                    projection:
                      'Page title, civic-service links and plain facts (opening-hours lines, closing days, question headings, payment methods, functional @stadt.wuerzburg.de mailboxes); no people, scripts or article text retained',
                  }
                : /html/.test(record.contentType ?? '')
                  ? projectPublicHtml(response.body)
                  : null;
          const isPdf = /application\/pdf/.test(record.contentType ?? '');
          const extension =
            projection?.extension ??
            (/json/.test(record.contentType ?? '') ? 'json' : isPdf ? 'pdf' : 'txt');
          const sample = projection?.body ?? (isPdf ? response.bytes : response.body);
          record.sample = `data/fixtures/${id}/response.${extension}`;
          if (projection !== null) record.projection = projection.projection;
          record.sampleSha256 = createHash('sha256').update(sample).digest('hex');
          await save(id, `response.${extension}`, sample);
        }
        record.reason =
          'Fetched; reuse license, geography, schema and field mapping require review before connection';
      }
      await save(id, 'response.meta.json', record);
    } catch (error) {
      record.reason =
        error instanceof Error
          ? error.message.replace(/\r?\n/g, ' ').slice(0, 300)
          : 'Fetch failed';
    }
  }
  // Failed and robots-blocked attempts need durable evidence too; response metadata remains reserved for actual responses.
  await save(id, 'attempt.meta.json', record);
  responses.push(record);
  await save('discovery', 'external.sources.json', {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    sources: responses,
  });
  process.stdout.write(
    `${id}: ${record.httpStatus ?? 'not fetched'} ${record.reason.slice(0, 90)}\n`,
  );
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}

await mkdir(new URL('data/sources/', ROOT), { recursive: true });
// A run with `--ids=` probes a few sources; earlier records of the others stay.
const externalLog = new URL('data/sources/wuerzburg.external.sources.json', ROOT);
const earlier = await readFile(externalLog, 'utf8').then(
  (text) => JSON.parse(text).sources,
  () => [],
);
const probed = new Set(responses.map((record) => record.id));
await writeFile(
  externalLog,
  `${JSON.stringify({ schemaVersion: 1, sources: [...earlier.filter((record) => !probed.has(record.id)), ...responses] }, null, 2)}\n`,
);
