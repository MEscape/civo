import type { CanonicalTargetField } from '../../application/contracts/data-source-constraints';

/**
 * Other names an API commonly gives the value a target field holds. A target always matches its
 * own name; these are the usual alternatives, tried in order of how certain the match is.
 */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  title: ['name', 'headline', 'subject'],
  name: ['fullname', 'title'],
  label: ['name', 'title', 'metric'],
  description: ['summary', 'abstract', 'details'],
  excerpt: ['summary', 'teaser', 'abstract'],
  content: ['body', 'text'],
  message: ['text', 'body'],
  startDate: ['start', 'startsat', 'begin', 'date', 'from'],
  endDate: ['end', 'endsat', 'until', 'to'],
  publishedAt: ['published', 'date', 'createdat'],
  observedAt: ['timestamp', 'time', 'measuredat', 'date'],
  location: ['place', 'venue', 'address'],
  category: ['type', 'kind', 'topic'],
  imageUrl: ['image', 'img', 'picture', 'photo', 'thumbnail'],
  href: ['url', 'link', 'website'],
  email: ['mail'],
  phone: ['tel', 'telephone'],
  role: ['position', 'jobtitle'],
  value: ['amount', 'reading'],
  unit: ['uom'],
  target: ['goal'],
};

/** `Start_Date`, `startDate` and `start-date` all read as `startdate`. */
function normalize(name: string): string {
  return name.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
}

/** The last name of a dot path: `data.startDate` is about `startDate`; list positions are ignored. */
function leafOf(path: string): string {
  const parts = path.split('.').filter((part) => !/^\d+$/.test(part));
  return normalize(parts.at(-1) ?? path);
}

/**
 * Guesses which discovered field holds each target field, by name. Every field and every target is
 * used at most once, and the guess for a required target is made first. It only proposes: the person
 * reviews it in the mapping and saves it, so a wrong guess costs one click.
 */
export function suggestAssignments(
  fields: ReadonlyArray<{ readonly path: string }>,
  targets: readonly CanonicalTargetField[],
): Record<string, string> {
  const leaves = fields.map((field) => ({ path: field.path, leaf: leafOf(field.path) }));
  const taken = new Set<string>();
  const suggestions: Record<string, string> = {};
  const ordered = [...targets].sort((a, b) => Number(b.required) - Number(a.required));

  for (const target of ordered) {
    const names = [normalize(target.path), ...(ALIASES[target.path] ?? [])];
    for (const name of names) {
      const match = leaves.find((field) => field.leaf === name && !taken.has(field.path));
      if (match !== undefined) {
        taken.add(match.path);
        suggestions[match.path] = target.path;
        break;
      }
    }
  }
  return suggestions;
}
