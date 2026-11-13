import type { ReactNode } from 'react';

import type * as NextNavigation from 'next/navigation';

import { fireEvent, render, screen } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

import { parsePageNodeId } from '@modules/builder/application/contracts/editor-model';
import type { EditorSessionView } from '@modules/builder/application/contracts/page-views';
import { BuilderEditor } from '@modules/builder/presentation/components/builder-editor';
import deBuilder from '@modules/builder/presentation/i18n/de.json';
import enBuilder from '@modules/builder/presentation/i18n/en.json';
import dePlatform from '@modules/component-platform/presentation/i18n/de.json';
import enPlatform from '@modules/component-platform/presentation/i18n/en.json';
import deMedia from '@modules/media/presentation/i18n/de.json';
import enMedia from '@modules/media/presentation/i18n/en.json';

import deApp from '@i18n/messages/de.json';
import enApp from '@i18n/messages/en.json';

import { okAsync } from '@lib/result';

import { resolveServerComponents } from '../../../../support/server-components';

const catalogs = {
  en: { ...enApp, ...enBuilder, ...enPlatform, ...enMedia },
  de: { ...deApp, ...deBuilder, ...dePlatform, ...deMedia },
};
vi.mock('@i18n/server', () => ({
  getMessages: async ({ locale }: { locale: 'en' | 'de' }) => catalogs[locale],
  getTimeZone: async () => 'UTC',
  getTranslations: async ({ locale, namespace }: { locale: 'en' | 'de'; namespace: 'builder' }) =>
    createTranslator({ locale, namespace, messages: catalogs[locale] }),
}));
vi.mock('@i18n', () => ({
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/websites/site-1/builder/page-1',
  getMessageFallback: ({ namespace, key }: { namespace: string; key: string }) =>
    `${namespace}.${key}`,
}));
vi.mock('@modules/builder/composition', () => ({ loadEditorSession: () => okAsync(session) }));
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof NextNavigation>()),
  useSearchParams: () => new URLSearchParams('select=hero-node'),
  notFound: () => {
    throw new Error('not-found');
  },
}));
vi.mock('@modules/builder/presentation/actions/save-page-config-action', () => ({
  savePageConfigAction: vi.fn(),
}));
vi.mock('@modules/builder/presentation/actions/render-draft-page-action', () => ({
  renderDraftPageAction: async () => ({ ok: true, data: null }),
}));
vi.mock('@modules/media/presentation/actions/list-media-assets-action', () => ({
  listMediaAssetsAction: async () => ({
    ok: true,
    data: { items: [], total: 0, page: 1, pageSize: 25, pageCount: 0 },
  }),
}));

const session: EditorSessionView = {
  page: {
    id: 'page-1',
    websiteId: 'site-1',
    title: 'Home',
    path: '',
    version: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    config: {
      type: 'page',
      children: [
        { id: parsePageNodeId('hero-node')._unsafeUnwrap(), type: 'hero', props: {}, children: [] },
      ],
    },
  },
  canRestructure: false,
  components: [
    {
      type: 'hero',
      category: 'content',
      labelKey: 'componentPlatform.components.hero.label',
      descriptionKey: 'componentPlatform.components.hero.description',
      sampleKey: 'componentPlatform.hero',
      acceptsChildren: false,
      allowedChildTypes: [],
      isAllowedAtRoot: true,
      isSingleton: true,
      municipalPropKeys: ['image'],
      blueprint: { type: 'hero', props: {}, children: [] },
      fields: [
        {
          key: 'image',
          control: 'media',
          labelKey: 'componentPlatform.components.hero.fields.image.label',
          placeholderKey: null,
          group: 'appearance',
          options: [],
          bounds: null,
          canonicalKind: null,
          defaultValue: null,
          itemFields: [],
        },
      ],
    },
  ],
};

describe('builder client translations', () => {
  for (const locale of ['en', 'de'] as const) {
    it(`provides ${locale} media translations to the real selected hero and image picker`, async () => {
      const tree = await BuilderEditor({
        locale,
        websiteId: 'site-1',
        pageId: 'page-1',
        searchParams: { select: 'hero-node' },
        themeStyle: {},
        publicSiteHref: () => '/s/test',
        choices: {
          listCompatibleDatasets: { execute: () => okAsync({ items: [], isTruncated: false }) },
          listContentCategories: { execute: () => okAsync({ byDataset: {}, sampleByKind: {} }) },
          getBookingChoices: { execute: () => okAsync({ services: [], categories: [] }) },
        },
      });
      render(await resolveServerComponents(tree));
      const media = catalogs[locale].media;
      fireEvent.click(await screen.findByRole('button', { name: media.picker.choose }));
      expect(await screen.findByText(media.picker.empty)).toBeVisible();
      expect(screen.getByRole('button', { name: media.picker.upload })).toBeVisible();
      const visible = screen.getByRole('switch', {
        name: catalogs[locale].builder.properties.visible,
      });
      fireEvent.click(visible);
      expect(visible).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByText(catalogs[locale].builder.properties.hiddenHint)).toBeVisible();
    });
  }
});
