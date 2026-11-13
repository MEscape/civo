import { I18nProvider } from '@components/providers/i18n-provider';
import { Alert } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { loadEditorSession } from '../../composition';
import { loadBuilderEditor } from '../loaders/load-builder-editor';
import { builderRoutes } from '../routes';

import { BuilderSessionProvider } from './builder-session-provider';
import { BuilderShell } from './builder-shell';

import type { BuilderEditorChoiceReaders } from '../loaders/load-builder-editor';
import type { ThemeStyle } from './canvas/canvas-theme-scope';

interface BuilderEditorProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly pageId: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  /** Choices owned by other modules, handed over by the route. */
  readonly choices: BuilderEditorChoiceReaders;
  /** CSS custom properties of the website's theme, computed by the route. */
  readonly themeStyle: ThemeStyle;
  /** Where a page of the website lives on the public site; the route knows the website's address. */
  readonly publicSiteHref: (pagePath: string) => string;
}

/**
 * Top-level Server Component of the visual editor. The editor's Client Components read `builder`
 * text and, through `useComponentText`, the platform components' labels (`componentPlatform`);
 * only this subtree receives them.
 */
export async function BuilderEditor({
  locale,
  websiteId,
  pageId,
  searchParams,
  choices,
  themeStyle,
  publicSiteHref,
}: BuilderEditorProps) {
  const t = await getTranslations({ locale, namespace: 'builder' });
  const view = await loadBuilderEditor({
    websiteId,
    pageId,
    searchParams,
    readers: { ...choices, getEditorSession: { execute: loadEditorSession } },
  });

  return (
    <I18nProvider locale={locale} namespaces={['builder', 'componentPlatform', 'map', 'media']}>
      {view.isDatasetListTruncated && (
        <Alert variant="warning" role="status">
          {t('properties.dataset.truncated')}
        </Alert>
      )}
      <BuilderSessionProvider
        key={view.session.page.id}
        session={view.session}
        datasetOptions={view.datasetOptions}
        categoryOptions={view.categoryOptions}
        bookingChoices={view.bookingChoices}
        initialSelection={view.initialSelection}
      >
        <BuilderShell
          pageTitle={view.page.title}
          themeStyle={themeStyle}
          links={{
            pages: builderRoutes.pages(websiteId),
            publicSite: publicSiteHref(view.page.path),
          }}
        />
      </BuilderSessionProvider>
    </I18nProvider>
  );
}
