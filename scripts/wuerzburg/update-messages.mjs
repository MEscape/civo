import { readFile, writeFile } from 'node:fs/promises';
import { URL } from 'node:url';

for (const locale of ['de', 'en']) {
  const target = new URL(
    `../../src/modules/component-platform/presentation/i18n/${locale}.json`,
    import.meta.url,
  );
  const messages = JSON.parse(await readFile(target, 'utf8'));
  messages.componentPlatform.components.quickLinks.fields.placement =
    locale === 'de'
      ? {
          label: 'Platzierung',
          options: { content: 'Inhaltsliste', header: 'Websitekopf', footer: 'Websitefuß' },
        }
      : {
          label: 'Placement',
          options: { content: 'Content list', header: 'Site header', footer: 'Site footer' },
        };
  messages.componentPlatform.quickLinks.skipToContent =
    locale === 'de' ? 'Zum Hauptinhalt springen' : 'Skip to main content';
  messages.componentPlatform.provenance.measuredAt = locale === 'de' ? 'Messzeit:' : 'Measured:';
  messages.componentPlatform.components.section.fields.layout =
    locale === 'de'
      ? {
          label: 'Anordnung',
          options: {
            stack: 'Untereinander',
            split: 'Zwei Spalten',
            aside: 'Inhalt mit Seitenspalte',
          },
        }
      : {
          label: 'Layout',
          options: { stack: 'Stack', split: 'Two columns', aside: 'Content with aside' },
        };
  messages.componentPlatform.components.section.fields.density =
    locale === 'de'
      ? { label: 'Abstände', options: { default: 'Standard', tight: 'Kompakt', airy: 'Großzügig' } }
      : { label: 'Density', options: { default: 'Default', tight: 'Compact', airy: 'Spacious' } };
  await writeFile(target, `${JSON.stringify(messages, null, 2)}\n`);
}
