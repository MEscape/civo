import { URL } from 'node:url';

const MAX_LABEL = 500;
const MAX_KEYWORDS = 100;
const MAX_DISTRIBUTIONS = 20;
const SENSITIVE_QUERY = /key|token|secret|password|credential/i;

/** Remove identical upstream duplicates; conflicting identities need review instead of silent data loss. */
export function uniqueSourceRecords(records) {
  const unique = new Map();
  for (const record of records) {
    if (typeof record.id !== 'string' || !record.id) throw new Error('Missing source identity');
    const previous = unique.get(record.id);
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(record))
      throw new Error('Conflicting source identity');
    unique.set(record.id, record);
  }
  return [...unique.values()];
}

function publicUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    if ([...url.searchParams.keys()].some((key) => SENSITIVE_QUERY.test(key))) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function label(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_LABEL ? value : null;
}

/** Allowlist catalog metadata; never persist creator/contact details or portal bootstrap credentials. */
export function datasetProjection(raw) {
  if (raw === null || typeof raw !== 'object' || raw['@type'] !== 'Dataset') return null;
  const name = label(raw.name);
  const url = publicUrl(raw.url);
  if (name === null || url === null) return null;
  const distribution = Array.isArray(raw.distribution)
    ? raw.distribution.slice(0, MAX_DISTRIBUTIONS).flatMap((item) => {
        if (item === null || typeof item !== 'object') return [];
        const contentUrl = publicUrl(item.contentUrl);
        const encodingFormat = label(item.encodingFormat);
        return contentUrl === null || encodingFormat === null
          ? []
          : [{ '@type': 'DataDownload', contentUrl, encodingFormat }];
      })
    : [];
  return {
    '@type': 'Dataset',
    name,
    url,
    license: publicUrl(raw.license),
    dateCreated: label(raw.dateCreated),
    dateModified: label(raw.dateModified),
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords.slice(0, MAX_KEYWORDS).filter((item) => label(item) !== null)
      : [],
    distribution,
  };
}

/** HTML is evidence, never an asset bundle: preserve relevant metadata or readable terms, excluding all scripts. */
export function projectPublicHtml(html) {
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (!/application\/ld\+json/i.test(match[1])) continue;
    try {
      const dataset = datasetProjection(JSON.parse(match[2]));
      if (dataset !== null)
        return {
          body: `${JSON.stringify(dataset, null, 2)}\n`,
          extension: 'json',
          projection:
            'Allowlisted Dataset JSON-LD only; descriptions, creators, contact details, portal scripts and credentials omitted',
        };
    } catch {
      /* Invalid embedded JSON is not source evidence. */
    }
  }
  return {
    body: html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''),
    extension: 'html',
    projection:
      'Document HTML with script elements removed; original response hash retained separately',
  };
}

/** Keep a building's public location, excluding people, editors and unrelated entity claims. */
export function projectWikidataPlace(body) {
  const entities = Object.values(JSON.parse(body).entities ?? {});
  if (entities.length !== 1) throw new Error('Expected one Wikidata place');
  const entity = entities[0];
  const coordinate = entity.claims?.P625?.find((claim) => claim.rank !== 'deprecated')?.mainsnak
    ?.datavalue?.value;
  const address = entity.claims?.P969?.find((claim) => claim.rank !== 'deprecated')?.mainsnak
    ?.datavalue?.value?.text;
  const name = label(entity.labels?.de?.value);
  if (
    !/^Q\d+$/.test(entity.id) ||
    name === null ||
    coordinate?.globe !== 'http://www.wikidata.org/entity/Q2' ||
    !Number.isFinite(coordinate.latitude) ||
    Math.abs(coordinate.latitude) > 90 ||
    !Number.isFinite(coordinate.longitude) ||
    Math.abs(coordinate.longitude) > 180
  )
    throw new Error('Invalid Wikidata place');
  return {
    extension: 'json',
    projection:
      'Building ID, German label, street address and Earth coordinate only; no people, editors or other claims',
    body:
      JSON.stringify(
        {
          records: [
            {
              id: entity.id,
              name,
              ...(label(address) === null ? {} : { address }),
              latitude: coordinate.latitude,
              longitude: coordinate.longitude,
            },
          ],
        },
        null,
        2,
      ) + '\n',
  };
}
