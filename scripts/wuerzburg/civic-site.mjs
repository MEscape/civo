import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

import { uniqueSourceRecords } from './catalog-projection.mjs';

const ROOT = new URL('../../', import.meta.url);
const SITE = '/de/s/wuerzburg';
const CITY_CREDIT = 'Quelle: Stadt Würzburg  opendata.wuerzburg.de';
const read = async (path) => JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
const instant = (value) => new Date(value).toISOString();
const CYCLE_HISTORY = 'cycle-history';
const METRIC_KIND = 'SmartCityMetric';
const POPULATION_DISTRICTS = 'population-districts';

/** Builds the citizen site from captured records. Old synthetic catalog examples never enter its page trees. */
export async function civicSite(base) {
  const sources = base.sources.filter((source) => source.config.provenance.kind !== 'synthetic');
  const sourceIds = new Set(sources.map((source) => source.id));
  const datasets = base.datasets.filter((dataset) => sourceIds.has(dataset.sourceId));
  const evidenceByKey = new Map();
  const counts = new Map();

  async function city(key, datasetId, canonicalKind, project) {
    const complete = ['fahrradstellplaetze-stadt-wuerzburg', 'abfallkalender-wuerzburg'].includes(
      datasetId,
    );
    const captureId = `${complete ? 'city-complete' : 'city-window'}-${datasetId}`;
    const prefix = `data/fixtures/${captureId}/`;
    const [body, capture, catalog] = await Promise.all([
      read(prefix + 'response.json'),
      read(prefix + 'response.meta.json'),
      read(`data/fixtures/city-asset-${datasetId}/response.json`),
    ]);
    const rows = complete ? body : body.results;
    if (capture.httpStatus !== 200 || !Array.isArray(rows) || !catalog.license)
      throw new Error(`Unverified city source ${datasetId}`);
    const licenseName = catalog.license.endsWith('/dl-by-de/2.0')
      ? 'Datenlizenz Deutschland – Namensnennung – Version 2.0'
      : catalog.license.endsWith('/cc-by/4.0')
        ? 'Creative Commons Namensnennung 4.0'
        : catalog.license.endsWith('/cc-by-sa/4.0')
          ? 'Creative Commons Namensnennung – Weitergabe unter gleichen Bedingungen 4.0'
          : null;
    if (licenseName === null) throw new Error(`Unreviewed license: ${datasetId}`);
    const evidence = {
      kind: 'snapshot',
      sourceId: captureId,
      sourceUrl: capture.url,
      fetchedAt: capture.fetchedAt,
      validUntil: null,
      license: licenseName,
      licenseUrl: catalog.license,
      attribution: CITY_CREDIT,
    };
    evidenceByKey.set(key, evidence);
    counts.set(key, { total: complete ? rows.length : body.total_count, loaded: rows.length });
    add(key, catalog.name, canonicalKind, project(rows), evidence);
  }

  function add(key, name, canonicalKind, records, evidence) {
    if (!records.length) throw new Error(`Empty source ${key}`);
    sources.push({
      id: `wuerzburg-source-${key}`,
      name,
      kind: 'MOCK',
      config: {
        schemaVersion: 1,
        records: uniqueSourceRecords(records).map((record) => ({
          ...record,
          _provenance: evidence,
        })),
        provenance: evidence,
        windowPolicy: {
          schemaVersion: 1,
          maxRecords: 500,
          maxOffset: 100000,
          orderBy:
            canonicalKind === 'SmartCityObservation'
              ? { field: 'observedAt', direction: 'desc' }
              : null,
        },
      },
    });
    datasets.push({
      id: `wuerzburg-dataset-${key}`,
      sourceId: `wuerzburg-source-${key}`,
      name,
      slug: key,
      canonicalKind,
      mapping: {
        fields: [...new Set(records.flatMap(Object.keys))]
          .filter((key) => key !== 'id')
          .map((field) => ({ sourcePath: field, targetPath: field, required: false })),
      },
    });
  }

  await city('districts', 'stadtbezirke', 'GeoFeature', (rows) =>
    rows.map((row) => ({
      id: row.name,
      name: row.name,
      geometry: row.geometry.geometry,
      category: 'Stadtbezirk',
    })),
  );
  await city('cycle-sites', 'bicycle_counter_sites', 'GeoFeature', (rows) =>
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      latitude: row.location.lat,
      longitude: row.location.lon,
      category: 'Fahrradzählstelle',
    })),
  );
  await city('cycle-parking', 'fahrradstellplaetze-stadt-wuerzburg', 'GeoFeature', (rows) =>
    rows.map((row) => ({
      id: row.id,
      name: row.title,
      latitude: row.geo_point_2d.lat,
      longitude: row.geo_point_2d.lon,
      category: row.categories_name,
    })),
  );
  await city('toilets', 'barrierefreie-toiletten-im-stadtgebiet-wuerzburg', 'GeoFeature', (rows) =>
    rows.map((row) => ({
      id: row.id,
      name: row.company,
      geometry: row.geometry.geometry,
      category: row.toilettype,
    })),
  );
  await city('climate-trees', 'klimabaeume-locations', 'GeoFeature', (rows) =>
    rows.map((row) => ({
      id: String(row.id),
      name: row.lage,
      latitude: row.geo_point_2d.lat,
      longitude: row.geo_point_2d.lon,
      category: row.baumart,
    })),
  );
  await city('trees', 'baumkataster_stadt_wuerzburg', 'GeoFeature', (rows) =>
    rows.map((row) => ({
      id: row.source_id,
      name: `${row.baumart} · ${row.source_id}`,
      latitude: row.geo_punkt.lat,
      longitude: row.geo_punkt.lon,
      category: row.baumtyp,
      description: row.baumart_la,
    })),
  );
  const [townHall, townHallCapture, wikidataTerms] = await Promise.all([
    read('data/fixtures/wikidata-rathaus/response.json'),
    read('data/fixtures/wikidata-rathaus/response.meta.json'),
    read('data/fixtures/wikidata-licensing/response.meta.json'),
  ]);
  if (
    townHallCapture.httpStatus !== 200 ||
    wikidataTerms.httpStatus !== 200 ||
    townHall.records?.length !== 1 ||
    townHall.records[0].id !== 'Q98486869'
  )
    throw new Error('Town hall location or license not verified');
  add('town-hall', 'Rathaus Würzburg: Gebäudestandort', 'GeoFeature', townHall.records, {
    kind: 'snapshot',
    sourceId: 'wikidata-rathaus',
    sourceUrl: 'https://www.wikidata.org/wiki/Q98486869',
    fetchedAt: townHallCapture.fetchedAt,
    validUntil: null,
    license: 'Creative Commons CC0 1.0 Universal',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution: 'Quelle: Wikidata · Rathaus Q98486869',
  });
  let cycleRows = [];
  await city(
    CYCLE_HISTORY,
    'fahrradzaehlung-tagesdaten-alle-zaehlstationen',
    'SmartCityObservation',
    (rows) =>
      (cycleRows = rows).map((row) => ({
        id: `${row.id}-${row.dayofyear}`,
        series: row.name,
        observedAt: `${row.dayofyear}T00:00:00.000Z`,
        value: row.count,
        unit: 'Fahrräder / Tag',
        resolution: 'P1D',
        category: 'Radverkehr',
      })),
  );
  // Derived from the same daily counts: the latest day's total and its split by counting station.
  const cycleDay = cycleRows
    .map((row) => row.dayofyear)
    .sort()
    .at(-1);
  const cycleDayRows = cycleRows.filter((row) => row.dayofyear === cycleDay);
  const cycleDayLabel = new Date(`${cycleDay}T00:00:00.000Z`).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  add(
    'cycle-kpis',
    'Radverkehr: letzter gezählter Tag',
    METRIC_KIND,
    [
      {
        id: 'cycle-day-total',
        label: `Gezählte Fahrräder am ${cycleDayLabel}`,
        value: cycleDayRows.reduce((sum, row) => sum + row.count, 0),
        unit: 'Fahrräder',
        observedAt: `${cycleDay}T00:00:00.000Z`,
        category: 'Radverkehr',
      },
      {
        id: 'cycle-stations',
        label: 'Zählstellen mit Meldung',
        value: cycleDayRows.length,
        unit: 'Zählstellen',
        observedAt: `${cycleDay}T00:00:00.000Z`,
        category: 'Radverkehr',
      },
    ],
    evidenceByKey.get(CYCLE_HISTORY),
  );
  add(
    'cycle-share',
    'Radverkehr nach Zählstelle',
    'SmartCityBreakdownEntry',
    cycleDayRows.map((row) => ({
      id: `${row.id}-${cycleDay}`,
      label: row.name,
      value: row.count,
      group: `Zählstellen am ${cycleDayLabel}`,
      unit: 'Fahrräder',
    })),
    evidenceByKey.get(CYCLE_HISTORY),
  );
  let parkingRecords = [];
  await city(
    'parking-places',
    'parkplatzdaten_wuerzburg',
    'GeoFeature',
    (rows) =>
      (parkingRecords = [
        ...new Map(
          rows.map((row) => row.id).map((id) => [id, rows.find((row) => row.id === id)]),
        ).values(),
      ].map((row) => ({
        id: String(row.id),
        name: row.name.replace(/^Würzburg\s+/, ''),
        status: row.status,
        observedAt: instant(row.values_from),
      }))),
  );
  const countBy = (records, field) =>
    [...Map.groupBy(records, (record) => record[field])].map(([label, group]) => ({
      label,
      value: group.length,
    }));
  add(
    'parking-status-share',
    'Parkhäuser und Parkplätze nach gemeldetem Status',
    'SmartCityBreakdownEntry',
    countBy(parkingRecords, 'status').map(({ label, value }) => ({
      id: `status-${label}`,
      label,
      value,
      group: 'Gemeldeter Status',
      unit: 'Anlagen',
    })),
    evidenceByKey.get('parking-places'),
  );
  // The window holds every toilet the source lists (its total is below the window size).
  if (counts.get('toilets').total !== counts.get('toilets').loaded)
    throw new Error('Toilet window is incomplete; the type split would be partial');
  const toiletRecords = sources.find((source) => source.id === 'wuerzburg-source-toilets').config
    .records;
  add(
    'toilet-types',
    'Öffentliche Toiletten nach Art',
    'SmartCityBreakdownEntry',
    countBy(toiletRecords, 'category').map(({ label, value }) => ({
      id: `type-${label}`,
      label,
      value,
      group: 'Toilettenart',
      unit: 'Standorte',
    })),
    evidenceByKey.get('toilets'),
  );
  // Source names are transliterated (Grombuehl); the boundary dataset spells them as citizens do.
  const districtName = new Map(
    sources
      .find((source) => source.id === 'wuerzburg-source-districts')
      .config.records.map((record) => [record.name.replaceAll('ü', 'ue'), record.name]),
  );
  let populationRows = [];
  let populationYears = [];
  await city(POPULATION_DISTRICTS, 'stadtbezirke_hauptwohnsitz', METRIC_KIND, (rows) => {
    populationRows = rows;
    // The newest year is published in thousands, the others in persons: only years where every district is counted in persons are used.
    populationYears = [...new Set(rows.map((row) => row.jahr))]
      .filter((year) => {
        const yearRows = rows.filter((row) => row.jahr === year);
        return yearRows.length === districtName.size && yearRows.every((row) => row.wert >= 1000);
      })
      .sort();
    const year = populationYears.at(-1);
    return rows
      .filter((row) => row.jahr === year)
      .map((row) => ({
        id: `${row.stadtbezirk}-${year}`,
        label: districtName.get(row.stadtbezirk) ?? row.stadtbezirk,
        value: row.wert,
        unit: 'Personen',
        category: `Hauptwohnsitz ${year}`,
      }))
      .sort((first, second) => second.value - first.value);
  });
  const populationTotal = (year) =>
    populationRows.filter((row) => row.jahr === year).reduce((sum, row) => sum + row.wert, 0);
  const [previousYear, latestYear] = populationYears.slice(-2);
  const changePercent =
    Math.round(
      ((populationTotal(latestYear) - populationTotal(previousYear)) /
        populationTotal(previousYear)) *
        1000,
    ) / 10;
  add(
    'population-total',
    'Einwohnerinnen und Einwohner',
    METRIC_KIND,
    [
      {
        id: 'population-total',
        label: 'Menschen mit Hauptwohnsitz in Würzburg',
        value: populationTotal(latestYear),
        unit: 'Personen',
        category: `Stand ${latestYear}`,
        trend: changePercent > 0 ? 'up' : changePercent < 0 ? 'down' : 'flat',
        changePercent,
      },
    ],
    evidenceByKey.get(POPULATION_DISTRICTS),
  );
  add(
    'population-history',
    'Einwohnerinnen und Einwohner im Zeitverlauf',
    'SmartCityObservation',
    populationYears.map((year) => ({
      id: `population-${year}`,
      series: 'Menschen mit Hauptwohnsitz',
      // The source names the year, not the reference day; the year's first day stands for it.
      observedAt: `${year}-01-01T00:00:00.000Z`,
      value: populationTotal(year),
      unit: 'Personen',
      resolution: 'P1Y',
      category: 'Bevölkerung',
    })),
    evidenceByKey.get(POPULATION_DISTRICTS),
  );
  // This station's last observation is old. It belongs in the historical series, never in a current-weather panel.
  await city('weather-history', 'wetterstation-ludwigkai', 'SmartCityObservation', (rows) =>
    rows.map((row) => ({
      id: row.zeit,
      series: 'Ludwigkai · mittlere Lufttemperatur',
      observedAt: instant(row.zeit),
      value: row.temperatur_durchschnitt,
      unit: '°C',
      category: 'Stadtklima',
    })),
  );
  await city('waste', 'abfallkalender-wuerzburg', 'WasteCollectionEntry', (rows) =>
    rows.map((row) => ({
      id: row.id,
      date: `${row.start}T00:00:00.000Z`,
      wasteType: row.kategorie,
      district: row.stadtteil_name,
    })),
  );
  add(
    'city-nature',
    'Stadtnatur in Zahlen',
    METRIC_KIND,
    [
      {
        id: 'tree-count',
        label: 'Bäume im städtischen Kataster',
        value: counts.get('trees').total,
        unit: 'Bäume',
        category: 'Stadtnatur',
      },
    ],
    evidenceByKey.get('trees'),
  );
  add(
    'district-count',
    'Stadtgliederung',
    METRIC_KIND,
    [
      {
        id: 'district-count',
        label: 'Stadtbezirke',
        value: counts.get('districts').total,
        unit: 'Stadtbezirke',
        category: 'Stadtgebiet',
      },
    ],
    evidenceByKey.get('districts'),
  );

  const civicCapture = await read('data/fixtures/city-service-home/response.meta.json');
  const civicLinks = await read('data/fixtures/city-service-home/response.json');
  const bookingLink = civicLinks.links.find((link) => link.label === 'Terminvereinbarung');
  if (!bookingLink || civicCapture.httpStatus !== 200)
    throw new Error('Official appointment link not verified');
  const civicEvidence = {
    kind: 'snapshot',
    sourceId: 'city-service-home',
    sourceUrl: civicCapture.url,
    fetchedAt: civicCapture.fetchedAt,
    validUntil: null,
    license:
      'Keine offene Lizenz ausgewiesen; ausschließlich sachliche Zusammenfassung und Verweise, keine Übernahme von Artikeln oder Medien.',
    licenseUrl: null,
    attribution: 'Quelle: Stadt Würzburg · Bürgerbüro',
  };
  const services = [
    {
      id: 'appointment',
      title: 'Termin im Bürgerbüro',
      description: 'Leistung auswählen und zur offiziellen Terminvereinbarung der Stadt wechseln.',
      href: `${SITE}/buergerservice/termine`,
      category: 'Termine',
      keywords: ['Termin', 'Bürgerbüro', 'Ausweis', 'Reisepass', 'Kfz'],
    },
    {
      id: 'residence',
      title: 'Wohnsitz an-, um- oder abmelden',
      description: 'Online-Angebot, Unterlagen und persönliche Vorsprache im Bürgerbüro.',
      href: 'https://www.wuerzburg.de/rathaus/buergerbuero/meldewesen/index.html',
      category: 'Meldewesen',
      keywords: ['Umzug', 'Anmeldung', 'Wohnung'],
    },
    {
      id: 'waste',
      title: 'Abfalltermine finden',
      description: 'Abfuhrtermine aus dem städtischen Abfallkalender.',
      href: `${SITE}/buergerservice/abfall`,
      category: 'Alltag',
      keywords: ['Müll', 'Tonne', 'Abfuhr'],
    },
    ...civicLinks.links
      .filter((link) =>
        ['Serviceleistungen A-Z', 'Serviceleistungen nach Lebenslagen', 'Öffnungszeiten'].includes(
          link.label,
        ),
      )
      // The city page links some topics twice under one label; one entry per label.
      .filter(
        (link, index, rows) =>
          rows.findIndex((item) => item.url === link.url || item.label === link.label) === index,
      )
      .map((link, index) => ({
        id: `official-${index}`,
        title: link.label,
        href: link.url,
        category: 'Verwaltung',
      })),
  ];
  add(
    'services-real',
    'Bürgerservice und Online-Angebote',
    'ServiceDetail',
    services,
    civicEvidence,
  );
  add(
    'top-tasks-real',
    'Häufige Anliegen',
    'Service',
    services
      .slice(0, 3)
      .map(({ id, title, description, href }) => ({ id, title, description, href })),
    civicEvidence,
  );

  // Opening hours, closing days and payment methods are facts of the city's information page.
  const [infoPage, infoCapture] = await Promise.all([
    read('data/fixtures/city-service-info/response.json'),
    read('data/fixtures/city-service-info/response.meta.json'),
  ]);
  const facts = infoPage.facts;
  if (infoCapture.httpStatus !== 200 || !facts || facts.openingHours.length < 2)
    throw new Error('Bürgerbüro opening hours not verified');
  const infoEvidence = {
    ...civicEvidence,
    sourceId: 'city-service-info',
    sourceUrl: infoCapture.url,
    fetchedAt: infoCapture.fetchedAt,
  };
  const WEEKDAY = {
    Montag: 'mon',
    Dienstag: 'tue',
    Mittwoch: 'wed',
    Donnerstag: 'thu',
    Freitag: 'fri',
  };
  const openingHours = (desk) =>
    desk.days.flatMap((line) => {
      const day = WEEKDAY[line.split(' ')[0]];
      const ranges = [...line.matchAll(/(\d{2}:\d{2})(?: Uhr)?\s*-\s*(\d{2}:\d{2})/g)];
      if (day === undefined || ranges.length === 0)
        throw new Error(`Unread opening hours: ${line}`);
      return ranges.map(([, opensAt, closesAt], index) => ({
        id: `${day}-${index}`,
        day,
        closed: false,
        opensAt,
        closesAt,
      }));
    });
  add(
    'opening-info',
    'Bürgerbüro: Informationsschalter',
    'OpeningHoursEntry',
    openingHours(facts.openingHours[0]),
    infoEvidence,
  );
  add(
    'opening-pass',
    'Bürgerbüro: Pass- und Führerscheinausgabe',
    'OpeningHoursEntry',
    openingHours(facts.openingHours[1]),
    infoEvidence,
  );
  const mailbox = facts.mailboxes.find((address) => address.startsWith('gewerbemeldung@'));
  if (!mailbox) throw new Error('Functional trade-registration mailbox not verified');
  add(
    'contacts',
    'Bürgerbüro: Kontaktwege',
    'Contact',
    [
      {
        id: 'gewerbe',
        name: 'Gewerbemeldung',
        role: 'Bürgerbüro der Stadt Würzburg',
        email: mailbox,
      },
    ],
    infoEvidence,
  );
  const officialLink = (label) => {
    const link = [...civicLinks.links, ...infoPage.links].find((item) => item.label === label);
    if (!link) throw new Error(`Official link not verified: ${label}`);
    return link.url;
  };
  add(
    'departments',
    'Bürgerbüro: Bereiche',
    'Department',
    [
      {
        id: 'meldewesen',
        name: 'Meldewesen',
        description: 'Wohnsitz anmelden, ummelden oder abmelden.',
        href: officialLink('Meldewesen'),
      },
      {
        id: 'dokumente',
        name: 'Ausweis, Reisepass, Dokumente',
        description: 'Anträge und Abholung im Rathaus, Zimmer 34.',
        href: officialLink('> alle Informationen zum Thema Ausweis, Reisepass, Dokumente'),
      },
      {
        id: 'gewerbe',
        name: 'Gewerbemeldung',
        description: 'Gewerbe an-, um- oder abmelden.',
        contacts: [{ id: 'gewerbe-mail', name: 'Gewerbemeldung', email: mailbox }],
      },
      {
        id: 'termine',
        name: 'Terminvereinbarung',
        description: 'Termin für Bürgerbüro, Zulassungs- und Führerscheinstelle buchen.',
        href: officialLink('Terminvereinbarung'),
      },
    ],
    infoEvidence,
  );
  const question = (start) => {
    const text = facts.questions.find((item) => item.startsWith(start));
    if (!text) throw new Error(`Question not on the city page: ${start}`);
    return text;
  };
  const faq = [
    {
      question: question('Wie vereinbare ich einen Termin'),
      answer:
        'Online im Terminportal der Stadt. Wählen Sie dort jedes Anliegen einzeln aus, auch die der Personen, die Sie begleiten, damit genug Zeit eingeplant wird.',
    },
    {
      question: question('Für welche Leistungen ist kein Termin'),
      answer:
        'Unter anderem die Abholung von Personalausweis, Reisepass und eID-Karte in Zimmer 34 des Rathauses. Dort gelten eigene Öffnungszeiten.',
    },
    {
      question: question('Wie kann ich im Bürgerbüro bezahlen?'),
      answer: `Möglich ist: ${facts.payment.map((item) => item.replace(/[,.]$|\soder$/g, '')).join('; ')}.`,
    },
    {
      question: 'An welchen Tagen ist das Bürgerbüro geschlossen?',
      answer: `Grundsätzlich an ${facts.closedOn
        .map((item) => item.replace(/^(am|an|sowie an)\s|[,.]$/g, '').trim())
        .join(', ')}.`,
    },
  ];

  let sequence = 0;
  const block = (type, props = {}, children = []) => ({
    id: `wuerzburg-civic-${++sequence}`,
    type,
    props,
    children,
  });
  const data = (type, key, heading, props = {}) =>
    block(type, { datasetId: `wuerzburg-dataset-${key}`, heading, ...props });
  const text = (heading, body) => block('richText', { heading, body });
  const map = (key, heading, extra = {}) =>
    block('map', {
      primaryDatasetId: `wuerzburg-dataset-${key}`,
      secondaryDatasetId: 'wuerzburg-dataset-districts',
      heading,
      limit: 250,
      pointStyle: 'markers',
      // The city outline is taller than wide; a standard frame draws it small between empty margins.
      height: 'tall',
      showFilters: false,
      showLegend: false,
      ...extra,
    });
  const links = (items) =>
    items.map(([path, label]) => ({ label, href: `${SITE}${path ? '/' + path : ''}` }));
  const navigation = [
    ['', 'Start'],
    ['buergerservice', 'Bürgerservice'],
    ['mobilitaet', 'Mobilität'],
    ['umwelt-klima', 'Umwelt & Klima'],
    ['stadt-in-zahlen', 'Stadt in Zahlen'],
    ['rathaus-politik', 'Rathaus'],
  ];
  const pages = [];
  function page(path, title, subtitle, children) {
    pages.push({
      path,
      title,
      provenance: civicEvidence,
      config: {
        type: 'page',
        children: [
          block('quickLinks', {
            heading: 'Würzburg',
            placement: 'header',
            links: links(navigation),
          }),
          block('hero', { title, subtitle }),
          ...children,
          block('quickLinks', {
            heading: 'Würzburg · Stadt und Service',
            placement: 'footer',
            links: links([
              ['kontakt', 'Kontakt & Anfahrt'],
              ['buergerservice/termine', 'Termin vereinbaren'],
              ['barrierefreiheit', 'Barrierefreiheit'],
              ['datenschutz', 'Datenschutz'],
              ['impressum', 'Impressum'],
            ]),
          }),
        ],
      },
    });
  }
  const dataId = (key) => `wuerzburg-dataset-${key}`;
  const topics = [
    {
      title: 'Mobilität',
      description: 'Radverkehr, Stellplätze, Parkstatus und Toiletten in der Stadt.',
      href: `${SITE}/mobilitaet`,
    },
    {
      title: 'Umwelt & Klima',
      description: 'Wasserstand des Mains, Klimabäume und Stadtnatur.',
      href: `${SITE}/umwelt-klima`,
    },
    {
      title: 'Stadt in Zahlen',
      description: 'Bevölkerung nach Stadtbezirk und Entwicklung seit 2019.',
      href: `${SITE}/stadt-in-zahlen`,
    },
    {
      title: 'Rathaus und Stadtleben',
      description: 'Verwaltung, Stadtrat, Kultur und Arbeiten bei der Stadt.',
      href: `${SITE}/rathaus-politik`,
    },
  ];
  page(
    '',
    'Würzburg. Mitten im Leben.',
    'Ihr Anliegen zuerst. Bürgerservice, Wege durch die Stadt und verständliche Daten zu unserem Lebensraum.',
    [
      data('serviceGrid', 'top-tasks-real', 'Was möchten Sie erledigen?'),
      block('section', { layout: 'split', density: 'tight', tone: 'muted' }, [
        data('kpiGrid', 'population-total', 'Würzburg wächst', { columns: 1 }),
        data('kpiGrid', 'water-level', 'Der Main am Pegel', { columns: 1 }),
      ]),
      data('dashboardGrid', 'cycle-kpis', 'Radverkehr in Würzburg', {
        trendDatasetId: dataId(CYCLE_HISTORY),
        breakdownDatasetId: dataId('cycle-share'),
        limit: 100,
      }),
      map('cycle-parking', 'Wo Sie Ihr Rad abstellen können', {
        pointStyle: 'heatmap',
        limit: 500,
      }),
      block('section', { layout: 'aside', tone: 'muted' }, [
        block('cardGrid', { heading: 'Themen der Stadt', columns: 2, cards: topics }),
        data('openingHours', 'opening-info', 'Bürgerbüro heute'),
      ]),
      block('callToAction', {
        heading: 'Termin im Bürgerbüro',
        body: 'Ausweis, Wohnsitz oder Führerschein: Für viele Anliegen buchen Sie vorab einen Termin im städtischen Portal.',
        buttonLabel: 'Termin vorbereiten',
        href: `${SITE}/buergerservice/termine`,
      }),
    ],
  );
  page(
    'buergerservice',
    'Ihr Anliegen. Der nächste Schritt.',
    'Leistung finden, online erledigen oder einen Termin bei der zuständigen Stelle vereinbaren.',
    [
      data('serviceFinder', 'services-real', 'Was suchen Sie?', {
        placeholder: 'Zum Beispiel Wohnsitz, Ausweis oder Abfall',
        description: 'Der passende Eintrag führt zum Online-Service oder zur Terminvereinbarung.',
      }),
      data('departmentDirectory', 'departments', 'Bereiche des Bürgerbüros', { columns: 2 }),
      block('section', { layout: 'aside', density: 'tight' }, [
        block('accordion', { heading: 'Häufige Fragen zum Bürgerbüro', items: faq }),
        data('contactCard', 'contacts', 'Gewerbe per E-Mail melden'),
      ]),
      block('callToAction', {
        heading: 'Sie möchten persönlich vorbeikommen?',
        body: 'Für viele Anliegen im Bürgerbüro benötigen Sie einen Termin. Wählen Sie zuerst Ihre Leistung.',
        buttonLabel: 'Termin und Leistung auswählen',
        href: `${SITE}/buergerservice/termine`,
      }),
    ],
  );
  page(
    'buergerservice/termine',
    'Gut vorbereitet zum Termin',
    'Die Terminvergabe erfolgt über das Buchungsportal der Stadt Würzburg.',
    [
      block('callToAction', {
        heading: 'Termin im Bürgerbüro vereinbaren',
        body: 'Im städtischen Portal wählen Sie Ihre Leistung und einen verfügbaren Termin. Die verbindliche Bestätigung erhalten Sie dort.',
        buttonLabel: 'Zum städtischen Buchungsportal',
        href: bookingLink.url,
      }),
      block('quickLinks', {
        heading: 'Vorher informieren',
        links: civicLinks.links
          .filter((link) =>
            [
              'Meldewesen',
              'Dafür brauchen Sie einen Termin',
              'Termin vereinbaren und stornieren',
              'Öffnungszeiten',
            ].includes(link.label),
          )
          .filter((link, index, rows) => rows.findIndex((item) => item.url === link.url) === index)
          .map((link) => ({ label: link.label, href: link.url })),
      }),
    ],
  );
  page(
    'buergerservice/abfall',
    'Wann wird Ihre Tonne geleert?',
    'Abfuhrtermine nach Stadtgebiet. Die vollständige Straßen- und Adressauswahl finden Sie im städtischen Kalender.',
    [
      data('wasteCalendar', 'waste', 'Nächste erfasste Abfuhrtermine', { limit: 20 }),
      block('callToAction', {
        heading: 'Ihre Straße, Ihr Abfallkalender',
        body: 'Der städtische Kalender ist als Datenquelle vollständig eingebunden. Hier sehen Sie die nächsten erfassten Termine. Prüfen Sie Ihren genauen Straßen- und Abfuhrbezirk im vollständigen Kalender.',
        buttonLabel: 'Vollständigen Abfallkalender öffnen',
        href: 'https://opendata.wuerzburg.de/explore/assets/abfallkalender-wuerzburg/',
      }),
    ],
  );
  page(
    'mobilitaet',
    'Gut unterwegs in Würzburg',
    'Mit dem Rad, zu Fuß oder mit dem Auto: Orte finden und verfügbare Verkehrsinformationen einordnen.',
    [
      block('cardGrid', {
        heading: 'Bus und Straßenbahn',
        columns: 2,
        cards: [
          {
            title: 'WVV Mobilität',
            description: 'Verbindungen und Informationen beim Verkehrsunternehmen.',
            href: 'https://www.wvv.de/mobilitaet/',
          },
          {
            title: 'Verkehrsverbund Mainfranken',
            description: 'Fahrplan und Tarif im Verbund.',
            href: 'https://www.vvm-info.de/',
          },
        ],
      }),
      map('cycle-parking', 'Rad abstellen', { showFilters: true, limit: 500 }),
      text(
        'Zum Kartenausschnitt',
        'Die veröffentlichten Fahrradstellplätze sind vollständig eingebunden. Die Stadtbezirke dienen zur Orientierung; die Karte enthält keine Straßennavigation.',
      ),
      data('statusBoard', 'parking-places', 'Parkhäuser und Parkplätze: gemeldeter Status', {
        limit: 100,
      }),
      block('section', { layout: 'split', density: 'tight' }, [
        data('metricDonut', 'parking-status-share', 'Status auf einen Blick', { limit: 10 }),
        text(
          'Parkstatus einordnen',
          'Die Quelle liefert einen Status und einen Meldezeitpunkt, keine Anzahl freier Stellplätze. Beachten Sie den Zeitpunkt der einzelnen Meldung.',
        ),
      ]),
      map('cycle-sites', 'Hier wird Radverkehr gezählt'),
      data('metricTrendChart', CYCLE_HISTORY, 'Radverkehr: veröffentlichte Tageszählungen', {
        limit: 100,
      }),
      data('metricDonut', 'cycle-share', 'Radverkehr nach Zählstelle', { limit: 10 }),
      map('toilets', 'Toiletten und barrierefreie WC-Angebote', {
        showFilters: true,
        pointStyle: 'clusters',
      }),
      data('metricDonut', 'toilet-types', 'Toiletten nach Art', { limit: 10 }),
    ],
  );
  page(
    'umwelt-klima',
    'Main, Stadtklima und Stadtnatur',
    'Messwerte mit Zeitpunkt und Herkunft. Karten zeigen die tatsächlichen Standorte der eingebundenen Daten.',
    [
      block('section', { layout: 'split', density: 'tight' }, [
        data('kpiGrid', 'water-level', 'Wasserstand am Main', { columns: 1 }),
        data('kpiGrid', 'city-nature', 'Bäume im Stadtgebiet', { columns: 1 }),
      ]),
      data('metricTrendChart', 'water-history', 'Main: Wasserstand im Tagesverlauf', {
        limit: 500,
      }),
      text(
        'Was der Pegel bedeutet',
        'Die Angabe in Zentimetern bezieht sich auf den Pegelnullpunkt. Die datierte Messreihe ist keine Hochwasserwarnung und keine Aussage zur Wassertiefe.',
      ),
      map('climate-trees', 'Klimaerlebnisbäume: Standorte'),
      block('callToAction', {
        heading: 'Jeden Baum im Stadtgebiet finden',
        body: 'Das städtische Baumkataster enthält über 43.000 Einträge mit Baumart und Standort. Im vollständigen Kataster können Sie Ihr Wohnumfeld erkunden.',
        buttonLabel: 'Vollständiges Baumkataster öffnen',
        href: 'https://opendata.wuerzburg.de/explore/assets/baumkataster_stadt_wuerzburg/',
      }),
    ],
  );
  page(
    'stadt-in-zahlen',
    'Würzburg verstehen',
    'Bevölkerung, Stadtgebiet und Messreihen. Einheiten, Bezugszeitraum und Datenherkunft bleiben sichtbar.',
    [
      block('section', { layout: 'split', density: 'tight' }, [
        data('kpiGrid', 'population-total', 'Bevölkerung', { columns: 1 }),
        data('kpiGrid', 'district-count', 'Stadtgliederung', { columns: 1 }),
      ]),
      data('metricChart', POPULATION_DISTRICTS, 'Einwohnerinnen und Einwohner nach Stadtbezirk'),
      data('metricTrendChart', 'population-history', 'Bevölkerung im Zeitverlauf', { limit: 50 }),
      block('section', { layout: 'split' }, [
        data('metricTable', POPULATION_DISTRICTS, 'Alle Stadtbezirke im Überblick'),
        map('districts', 'Die 13 Stadtbezirke', {
          secondaryDatasetId: undefined,
          showFilters: false,
        }),
      ]),
      block('tabs', {
        tabs: [
          {
            label: 'Bevölkerung',
            body: `Gezählt werden Menschen mit Hauptwohnsitz in Würzburg, je Stadtbezirk und Jahr. Die Quelle nennt das Jahr, nicht den Stichtag. Für ${latestYear} und früher liegen Personenzahlen vor; die neueste Jahreszahl veröffentlicht die Quelle gerundet in Tausend, sie ist deshalb nicht dargestellt.`,
          },
          {
            label: 'Radverkehr',
            body: 'Automatische Zählstellen erfassen Fahrräder pro Tag. Eine Zählstelle zeigt den Verkehr an ihrem Standort, nicht in der ganzen Stadt.',
          },
          {
            label: 'Parken',
            body: 'Parkhäuser melden einen Status wie „frei“ oder „fast voll“ mit Meldezeitpunkt. Eine Zahl freier Plätze liefert die Quelle nicht.',
          },
          {
            label: 'Wasserstand',
            body: 'Der Pegel Würzburg misst den Wasserstand des Mains in Zentimetern über dem Pegelnullpunkt. Er ist keine Hochwasserwarnung.',
          },
        ],
      }),
      block('quickLinks', {
        heading: 'Daten vertiefen',
        links: [
          { label: 'Städtisches Open-Data-Portal', href: 'https://opendata.wuerzburg.de/explore/' },
          { label: 'Main und Stadtklima', href: `${SITE}/umwelt-klima` },
        ],
      }),
    ],
  );
  page(
    'rathaus-politik',
    'Rathaus und Stadtleben',
    'Verwaltung, demokratische Entscheidungen und die Themen der Stadt an einem Ort.',
    [
      block('cardGrid', {
        heading: 'Orientierung',
        columns: 2,
        cards: [
          {
            title: 'Bürgerbüro und Verwaltung',
            description: 'Leistungen, Öffnungszeiten und Terminvereinbarung.',
            href: 'https://www.wuerzburg.de/rathaus/buergerbuero/index.html',
          },
          {
            title: 'Stadtrat und Ausschüsse',
            description: 'Öffentliche Informationen im Bürgerinformationssystem.',
            href: 'https://www.wuerzburg.sitzung-online.de/',
          },
          {
            title: 'Kultur und Veranstaltungen',
            description: 'Das Veranstaltungsangebot der Stadt.',
            href: 'https://www.wuerzburg.de/tourismus/veranstaltungen/',
          },
          {
            title: 'Smart City',
            description: 'Projekte aus Stadt und Landkreis Würzburg.',
            href: 'https://www.stadt-land-wue.de/',
          },
          {
            title: 'Bauen und Planen',
            description: 'Bauvorhaben, Stadtplanung und Informationen rund ums Wohnen.',
            href: 'https://www.wuerzburg.de/themen/bauen-planen',
          },
          {
            title: 'Gesundheit und Soziales',
            description: 'Beratung, Unterstützung und Angebote für unterschiedliche Lebenslagen.',
            href: 'https://www.wuerzburg.de/themen/gesundheit-soziales',
          },
          {
            title: 'Kultur und Bildung',
            description: 'Bildungseinrichtungen und das kulturelle Angebot der Stadt.',
            href: 'https://www.wuerzburg.de/themen/kultur-bildung-kulturangebot',
          },
          {
            title: 'Arbeiten bei der Stadt',
            description: 'Die aktuellen Stellenangebote im städtischen Karriereportal.',
            href: 'https://karriere.wuerzburg.de/stellenangebote',
          },
        ],
      }),
      block('quickLinks', {
        heading: 'Weitere städtische Angebote',
        links: [
          {
            label: 'Alle Leistungen im Bürgerbüro',
            href: 'https://www.wuerzburg.de/rathaus/buergerbuero/index.html',
          },
          { label: 'Daten und Stadtbezirke', href: `${SITE}/stadt-in-zahlen` },
        ],
      }),
    ],
  );
  page(
    'kontakt',
    'Bürgerbüro: Kontakt und Anfahrt',
    'Das Bürgerbüro finden Sie im Rathaus, Rückermainstraße 2, 97070 Würzburg.',
    [
      text(
        'Vor Ihrem Besuch',
        'Prüfen Sie die Öffnungszeiten der zuständigen Stelle und vereinbaren Sie bei Bedarf einen Termin. Informationsschalter, Passausgabe und einzelne Fachstellen haben unterschiedliche Zeiten.',
      ),
      block('section', { layout: 'split', density: 'tight', tone: 'muted' }, [
        data('openingHours', 'opening-info', 'Informationsschalter'),
        data('openingHours', 'opening-pass', 'Pass- und Führerscheinausgabe'),
      ]),
      data('contactCard', 'contacts', 'Kontakt per E-Mail'),
      block('quickLinks', {
        heading: 'Besuch planen',
        links: [
          {
            label: 'Öffnungszeiten und Hinweise der Stadt',
            href: 'https://www.wuerzburg.de/rathaus/buergerbuero/allgemeine-informationen-zum-buergerbuero',
          },
          { label: 'Leistung und Termin auswählen', href: `${SITE}/buergerservice/termine` },
        ],
      }),
      map('town-hall', 'Das Rathaus im Stadtgebiet'),
    ],
  );
  // Operator-specific declarations cannot be copied from the city: they must match the operator of this deployment.
  for (const [path, title, lead, heading, body] of [
    [
      'impressum',
      'Impressum',
      'Wer diese Website betreibt und verantwortet.',
      'Angaben zum Betreiber stehen noch aus',
      'Für diese Bereitstellung liegen noch keine freigegebenen Angaben zum verantwortlichen Betreiber vor. Vor einer öffentlichen Inbetriebnahme müssen die Angaben zum Betreiber ergänzt und geprüft werden.',
    ],
    [
      'datenschutz',
      'Datenschutz',
      'Welche Daten beim Besuch dieser Website verarbeitet werden.',
      'Was bereits feststeht',
      'Die Kartenansicht lädt keine externen Kartendienste. Eine verbindliche Datenschutzerklärung für Hosting, Protokollierung und Kontaktwege muss der Betreiber vor der öffentlichen Inbetriebnahme bereitstellen.',
    ],
    [
      'barrierefreiheit',
      'Barrierefreiheit',
      'Wie barrierefrei diese Website ist und wo Sie Barrieren melden.',
      'Stand der Prüfung',
      'Karten bieten eine Liste; Diagramme bieten Datentabellen. Eine verbindliche Erklärung nach Prüfung des vollständigen Angebots und ein freigegebener Kontaktweg für Rückmeldungen stehen noch aus.',
    ],
  ])
    page(path, title, lead, [text(heading, body)]);
  pages.push({
    path: 'component-lab',
    title: 'Internes Komponentenlabor',
    provenance: civicEvidence,
    config: {
      type: 'page',
      children: [
        text('Prüfbereich', 'Nicht Bestandteil der öffentlichen Navigation.'),
        map('districts', 'Stadtbezirke', { secondaryDatasetId: undefined }),
        data('metricTrendChart', 'water-history', 'Pegelreihe', { limit: 500 }),
        map('trees', 'Baumkataster: begrenzte Vertragsprüfungsstichprobe'),
        data(
          'metricTrendChart',
          'weather-history',
          'Ludwigkai: historischer Vertragsprüfungsdatensatz',
          { limit: 100 },
        ),
        block('booking', { heading: 'Terminverwaltung: interner Prüfbereich' }),
      ],
    },
  });
  return {
    ...base,
    website: {
      ...base.website,
      name: 'Würzburg · Stadt und Service',
      description:
        'Bürgerservice, Mobilität, Umwelt und Stadtinformationen mit dokumentierten öffentlichen Daten.',
    },
    sources,
    datasets,
    pages,
    limitations: [
      'Öffentliche Inbetriebnahme erfordert freigegebene Betreiber- und Rechtstexte.',
      'Daten sind datierte Momentaufnahmen; automatischer Abruf ist noch nicht eingerichtet.',
      'Die Kartenübersicht zeigt Quelldaten ohne Straßenhintergrund.',
      'Die öffentliche Terminseite führt zur städtischen Vergabe; lokale Prüf-Buchungen sind kein städtischer Termin.',
      'Keine geprüfte aktuelle Wetter- oder Warnungsversorgung.',
    ],
  };
}
