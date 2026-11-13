import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MODULES = join(ROOT, 'src/modules');
const LOCALES = ['de', 'en'] as const;

/** The events a module keeps in the audit trail: every `TRAIL_BY_EVENT` entry that is not `false`. */
function keptEvents(): string[] {
  return readdirSync(MODULES).flatMap((module) => {
    const directory = join(MODULES, module, 'infrastructure/audit');
    let files: string[];
    try {
      files = readdirSync(directory);
    } catch {
      return [];
    }
    return files.flatMap((file) => {
      const source = readFileSync(join(directory, file), 'utf8');
      const block = /TRAIL_BY_EVENT = \{([\s\S]*?)\}/.exec(source)?.[1] ?? '';
      return [...block.matchAll(/'([a-z_]+\.[a-z_]+)':\s*([^,\n]+)/g)]
        .filter((match) => match[2]?.trim() !== 'false')
        .map((match) => match[1] ?? '');
    });
  });
}

/** `kind -> namespace` as the audit screen resolves it, read from its loader. */
function namespaceOfKind(): Record<string, string> {
  const source = readFileSync(
    join(MODULES, 'audit/presentation/loaders/load-audit-event-labels.ts'),
    'utf8',
  );
  const block = /NAMESPACE_OF_KIND[^{]*\{([\s\S]*?)\}/.exec(source)?.[1] ?? '';
  return Object.fromEntries(
    [...block.matchAll(/([a-z_]+): '([A-Za-z]+)'/g)].map((match) => [match[1], match[2]]),
  );
}

/** Every module catalog of one locale, merged by namespace. */
function catalog(locale: string): Record<string, unknown> {
  return Object.assign(
    {},
    ...readdirSync(MODULES).flatMap((module) => {
      try {
        return [
          JSON.parse(
            readFileSync(join(MODULES, module, `presentation/i18n/${locale}.json`), 'utf8'),
          ) as Record<string, unknown>,
        ];
      } catch {
        return [];
      }
    }),
  ) as Record<string, unknown>;
}

function labelOf(words: Record<string, unknown>, namespace: string, type: string): unknown {
  const [kind = '', name = ''] = type.split('.');
  const events = (words[namespace] as { auditEvents?: Record<string, Record<string, unknown>> })
    ?.auditEvents;
  return events?.[kind]?.[name];
}

describe('audit event labels', () => {
  const kept = keptEvents();
  const namespaces = namespaceOfKind();

  it('finds the events the trail keeps', () => {
    expect(kept.length).toBeGreaterThan(0);
  });

  it.each(LOCALES)(
    'words every kept event in %s, so the audit screen never shows a code',
    (locale) => {
      const words = catalog(locale);
      const unworded = kept.filter((type) => {
        const namespace = namespaces[type.split('.')[0] ?? ''];
        return namespace === undefined || typeof labelOf(words, namespace, type) !== 'string';
      });
      expect(unworded).toEqual([]);
    },
  );
});
