import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const ADAPTER = 'src/modules/booking/presentation/components/admin/calendar-adapter.client.tsx';
const NON_CODE = /\.(json|md)$/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe('the calendar library boundary', () => {
  const files = sourceFiles(join(ROOT, 'src')).filter((file) => !NON_CODE.test(file));

  it('is crossed by the adapter file alone', () => {
    const importers = files
      .filter((file) => /from\s+['"]@fullcalendar\//.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(importers).toEqual([ADAPTER]);
  });

  it('keeps the booking engine free of React, Next.js and the calendar', () => {
    const engine = sourceFiles(join(ROOT, 'src/modules/booking/domain')).concat(
      sourceFiles(join(ROOT, 'src/modules/booking/application')),
    );
    const offenders = engine.filter((file) =>
      /from\s+['"](react|react-dom|next|next\/[^'"]+|@fullcalendar\/[^'"]+)['"]/.test(
        readFileSync(file, 'utf8'),
      ),
    );
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([]);
  });

  it('only uses the MIT-licensed FullCalendar packages', () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    const used = Object.keys(manifest.dependencies)
      .filter((name) => name.startsWith('@fullcalendar/'))
      .sort();
    expect(used).toEqual([
      '@fullcalendar/core',
      '@fullcalendar/daygrid',
      '@fullcalendar/list',
      '@fullcalendar/react',
      '@fullcalendar/timegrid',
    ]);
  });
});
