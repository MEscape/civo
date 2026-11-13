import { describe, expect, it } from 'vitest';

import { RELEASE_VALIDATION_CODES as CODES } from '@modules/release/domain/errors/release-errors';
import { toWebsiteId } from '@modules/release/domain/models/ids';
import type {
  PublishableWebsite,
  PublishablePage,
  ComponentResolver,
} from '@modules/release/domain/publishing/publishable';
import { assembleReleaseSnapshot } from '@modules/release/domain/publishing/release-assembly';

describe('assembleReleaseSnapshot domain logic', () => {
  const website: PublishableWebsite = {
    id: toWebsiteId('site-1'),
    name: 'City of Testville',
    slug: 'testville',
    description: 'Official portal',
    theme: {
      colorScheme: 'emerald',
      fontFamily: 'Inter',
    } as any,
  };

  const samplePage: PublishablePage = {
    status: 'ready',
    path: '',
    title: 'Home',
    config: { type: 'page', children: [] },
    componentTypes: ['hero', 'newsGrid'],
  };

  const mockResolver: ComponentResolver = (type: string) => {
    if (type === 'hero') {
      return {
        type: 'hero',
        version: 2,
        contracts: [{ contract: 'civo.component', currentVersion: 2, minVersion: 1 }],
      };
    }
    if (type === 'newsGrid') {
      return {
        type: 'newsGrid',
        version: 1,
        contracts: [{ contract: 'civo.component', currentVersion: 1, minVersion: 1 }],
      };
    }
    return null; // unregistered
  };

  it('assembles a clean release snapshot with unique dependencies', () => {
    const page2: PublishablePage = {
      status: 'ready',
      path: 'about',
      title: 'About Us',
      config: { type: 'page', children: [] },
      componentTypes: ['hero'], // duplicate hero component
    };

    const result = assembleReleaseSnapshot({
      website,
      pages: [samplePage, page2],
      maps: [],
      resolveComponent: mockResolver,
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.website).toEqual({
        id: 'site-1',
        name: 'City of Testville',
        slug: 'testville',
        description: 'Official portal',
      });
      expect(result.value.pages).toHaveLength(2);
      expect(result.value.dependencies).toHaveLength(2); // hero and newsGrid, deduplicated
      expect(result.value.dependencies.map((d) => d.type).sort()).toEqual(['hero', 'newsGrid']);
    }
  });

  it('freezes every saved map into the snapshot, in a stable order', () => {
    const map = (id: string) => ({
      id,
      name: `Map ${id}`,
      description: null,
      settings: { isPublic: true, layers: [{ datasetId: 'd1', label: 'Buildings' }] },
    });

    const result = assembleReleaseSnapshot({
      website,
      pages: [samplePage],
      maps: [map('b'), map('a')],
      resolveComponent: mockResolver,
    });

    expect(result.isOk() && result.value.maps.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('blocks assembly when pages array is empty', () => {
    const result = assembleReleaseSnapshot({
      website,
      pages: [],
      maps: [],
      resolveComponent: mockResolver,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.fieldErrors['pages']).toContain(CODES.noPages);
    }
  });

  it('blocks assembly when a page has missing or invalid config', () => {
    const missingPage: PublishablePage = {
      status: 'config_missing',
      path: 'contact',
      title: 'Contact',
    };
    const invalidPage: PublishablePage = {
      status: 'config_invalid',
      path: '',
      title: 'Home',
    };

    const result = assembleReleaseSnapshot({
      website,
      pages: [missingPage, invalidPage],
      maps: [],
      resolveComponent: mockResolver,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.fieldErrors['pages.contact']).toContain(CODES.pageConfigMissing);
      expect(result.error.fieldErrors['pages.home']).toContain(CODES.pageConfigInvalid);
    }
  });

  it('blocks assembly when a component has an incompatible contract version', () => {
    const incompatibleResolver: ComponentResolver = (type: string) => ({
      type,
      version: 1,
      contracts: [{ contract: 'core.data', currentVersion: 1, minVersion: 2 }], // current 1 < min 2
    });

    const result = assembleReleaseSnapshot({
      website,
      pages: [samplePage],
      maps: [],
      resolveComponent: incompatibleResolver,
    });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.fieldErrors['pages.home.hero']).toContain(CODES.contractIncompatible);
    }
  });
});
