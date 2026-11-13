import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { I18N_CONFIG } from '@i18n/config';

/**
 * Translation completeness (docs/rules/i18n.md): every catalog has the same
 * keys in every locale, no empty text, and the same ICU arguments, so a
 * locale can never fall back to a raw key or drop a value. Literal keys used
 * in code are already checked by the compiler through the typed catalog.
 *
 * Two more things the translators cannot see: a brace that is meant as text must be quoted (`'{west}'`),
 * or it reads as an argument nobody passes; and a message with arguments is never used without values.
 */

const ROOT = process.cwd();
const [REFERENCE_LOCALE, ...OTHER_LOCALES] = I18N_CONFIG.locales;

interface Catalog {
  readonly [key: string]: string | Catalog;
}

/** Every catalog by owner: the app shell, then one per module that owns texts. */
function catalogPaths(): ReadonlyArray<{
  readonly owner: string;
  readonly path: (locale: string) => string;
}> {
  // `src/modules` is created with the first module.
  const modulesDir = join(ROOT, 'src/modules');
  const modules = existsSync(modulesDir)
    ? readdirSync(modulesDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => {
          try {
            return readdirSync(join(modulesDir, name, 'presentation/i18n')).length > 0;
          } catch {
            return false;
          }
        })
    : [];
  return [
    { owner: 'app', path: (locale) => `src/i18n/messages/${locale}.json` },
    ...modules.map((name) => ({
      owner: name,
      path: (locale: string) => `src/modules/${name}/presentation/i18n/${locale}.json`,
    })),
  ];
}

function flatten(catalog: Catalog, prefix = ''): Map<string, string> {
  const entries = new Map<string, string>();
  for (const [key, value] of Object.entries(catalog)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') {
      entries.set(path, value);
    } else {
      for (const [nested, text] of flatten(value, path)) {
        entries.set(nested, text);
      }
    }
  }
  return entries;
}

/** The names of an ICU message's arguments (`{count, plural, …}` → `count`); plural branch text is ignored. */
function argumentNames(message: string): string[] {
  // `'{west}'` is quoted text (ICU apostrophe escaping), not an argument.
  const text = message.replace(/'[{}][^']*'/g, '');
  const names = new Set<string>();
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '{') {
      if (depth % 2 === 0) {
        const match = /^\{\s*(\w+)/.exec(text.slice(index));
        if (match?.[1] !== undefined) {
          names.add(match[1]);
        }
      }
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
    }
  }
  return [...names].sort();
}

/** Every source file of the app: where a message can be asked for. */
function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

const load = (path: string) =>
  flatten(JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as Catalog);

describe('translation catalogs', () => {
  const catalogs = catalogPaths();

  it('finds the app shell and the module catalogs', () => {
    expect(catalogs.map((c) => c.owner)).toContain('app');
    expect(catalogs.length).toBeGreaterThan(0);
  });

  for (const { owner, path } of catalogs) {
    for (const locale of OTHER_LOCALES) {
      it(`${owner}: '${locale}' has exactly the keys of '${REFERENCE_LOCALE}', with the same arguments`, () => {
        const reference = load(path(I18N_CONFIG.defaultLocale));
        const translated = load(path(locale));

        expect(
          [...translated.keys()].filter((key) => !reference.has(key)),
          'keys only in the translation',
        ).toEqual([]);
        expect(
          [...reference.keys()].filter((key) => !translated.has(key)),
          'keys missing from the translation',
        ).toEqual([]);
        const argumentMismatches = [...reference].filter(
          ([key, text]) =>
            argumentNames(text).join() !== argumentNames(translated.get(key) ?? '').join(),
        );
        expect(
          argumentMismatches.map(([key]) => key),
          'ICU arguments differ',
        ).toEqual([]);
      });
    }

    it(`${owner}: no text is empty`, () => {
      for (const locale of I18N_CONFIG.locales) {
        const empty = [...load(path(locale))]
          .filter(([, text]) => text.trim() === '')
          .map(([key]) => key);
        expect(empty, `${locale} has empty texts`).toEqual([]);
      }
    });
  }

  it('has no message with arguments that the code asks for without passing any value', () => {
    // One pass per file: the keys it names alone in a call, `t('some.key')`, with no values.
    const files = sourceFiles(join(ROOT, 'src')).map((file) => {
      const text = readFileSync(file, 'utf8');
      const bare = new Set(
        [...text.matchAll(/\(\s*['"]([\w.]+)['"]\s*\)/g)].map((match) => match[1] ?? ''),
      );
      return { text, bare };
    });
    const misuses: string[] = [];
    for (const { owner, path } of catalogs) {
      for (const [key, message] of load(path(I18N_CONFIG.defaultLocale))) {
        if (argumentNames(message).length === 0) {
          continue;
        }
        // Code names the key without its namespace (`useTranslations('dataSources')` then
        // `t('sourceForm.…')`), so a bare use counts in a file that names the namespace.
        const [namespace = '', ...rest] = key.split('.');
        const relative = rest.join('.');
        const isBare = ({ text, bare }: (typeof files)[number]) =>
          bare.has(key) || (bare.has(relative) && text.includes(`'${namespace}'`));
        if (files.some(isBare)) {
          misuses.push(`${owner}: ${key}`);
        }
      }
    }
    expect(misuses, 'asked for without the values its arguments need').toEqual([]);
  }, 60_000);
});
