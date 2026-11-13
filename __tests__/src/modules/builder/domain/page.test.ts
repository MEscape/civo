import { describe, expect, it } from 'vitest';

import { BUILDER_VALIDATION_CODES as CODES } from '@modules/builder/domain/errors/builder-errors';
import {
  HOME_PAGE_PATH,
  PAGE_LIMITS,
  createPageDraft,
  createSystemPageDraft,
  parsePageVersion,
} from '@modules/builder/domain/models/page';

describe('page domain logic', () => {
  describe('createPageDraft', () => {
    it('creates a valid page draft with empty config', () => {
      const result = createPageDraft({
        websiteId: 'website-123',
        title: 'About Us',
        path: 'about-us',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({
          websiteId: 'website-123',
          title: 'About Us',
          path: 'about-us',
          config: {
            type: 'page',
            children: [],
          },
        });
      }
    });

    it('accepts home page with empty path', () => {
      const result = createPageDraft({
        websiteId: 'website-123',
        title: 'Home',
        path: HOME_PAGE_PATH,
      });
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.path).toBe('');
      }
    });

    it('accepts multi-segment nested paths', () => {
      const result = createPageDraft({
        websiteId: 'website-123',
        title: 'Annual Report 2026',
        path: 'news/reports/annual-report-2026',
      });
      expect(result.isOk()).toBe(true);
    });

    it('validates title boundaries', () => {
      const tooShort = createPageDraft({
        websiteId: 'website-123',
        title: 'A',
        path: 'test',
      });
      expect(tooShort.isErr()).toBe(true);
      if (tooShort.isErr()) {
        expect(tooShort.error.fieldErrors['title']).toContain(CODES.titleTooShort);
      }

      const tooLong = createPageDraft({
        websiteId: 'website-123',
        title: 'A'.repeat(PAGE_LIMITS.titleMax + 1),
        path: 'test',
      });
      expect(tooLong.isErr()).toBe(true);
      if (tooLong.isErr()) {
        expect(tooLong.error.fieldErrors['title']).toContain(CODES.titleTooLong);
      }
    });

    it('validates path format and length', () => {
      const tooLong = createPageDraft({
        websiteId: 'website-123',
        title: 'Long Path Page',
        path: 'a'.repeat(PAGE_LIMITS.pathMax + 1),
      });
      expect(tooLong.isErr()).toBe(true);
      if (tooLong.isErr()) {
        expect(tooLong.error.fieldErrors['path']).toContain(CODES.pathTooLong);
      }

      const invalidCharacters = [
        'About Us',
        'about_us',
        'about/us/',
        '/about',
        'about--us',
        'ABOUT',
      ];
      for (const invalidPath of invalidCharacters) {
        const res = createPageDraft({
          websiteId: 'website-123',
          title: 'Valid Title',
          path: invalidPath,
        });
        expect(res.isErr()).toBe(true);
        if (res.isErr()) {
          expect(res.error.fieldErrors['path']).toContain(CODES.pathInvalid);
        }
      }
    });

    it('validates websiteId', () => {
      const result = createPageDraft({
        websiteId: '',
        title: 'Valid Title',
        path: 'valid-path',
      });
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.fieldErrors['websiteId']).toContain(CODES.idInvalid);
      }
    });
  });

  describe('createSystemPageDraft', () => {
    it('creates a system page draft with seeded nodes', () => {
      const nodes = [
        {
          id: 'text-1',
          type: 'text',
          props: { content: 'Welcome to our municipality' },
          children: [],
        },
      ];

      const result = createSystemPageDraft({
        websiteId: 'website-123',
        title: 'System Seed Page',
        path: 'system-seed',
        nodes,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.config.children).toHaveLength(1);
        expect(result.value.config.children[0]?.id).toBe('text-1');
      }
    });

    it('rejects invalid node configuration', () => {
      const result = createSystemPageDraft({
        websiteId: 'website-123',
        title: 'Bad Nodes',
        path: 'bad-nodes',
        nodes: 'not-an-array',
      });
      expect(result.isErr()).toBe(true);
    });
  });

  describe('parsePageVersion', () => {
    it('accepts positive integers starting at 1', () => {
      expect(parsePageVersion(1)._unsafeUnwrap()).toBe(1);
      expect(parsePageVersion(42)._unsafeUnwrap()).toBe(42);
    });

    it('rejects zero, negative numbers, floats, and NaN', () => {
      expect(parsePageVersion(0).isErr()).toBe(true);
      expect(parsePageVersion(-5).isErr()).toBe(true);
      expect(parsePageVersion(1.5).isErr()).toBe(true);
      expect(parsePageVersion(Number.NaN).isErr()).toBe(true);
    });
  });
});
