import { describe, expect, it } from 'vitest';

import {
  capitalize,
  escapeHtml,
  isBlank,
  normalizeWhitespace,
  slugify,
  stripHtml,
  truncate,
} from '@lib/utils/string';

describe('slugify', () => {
  it('transliterates German characters', () => {
    expect(slugify('Bürgerbüro Größe Äpfel')).toBe('buergerbuero-groesse-aepfel');
  });

  it('strips other accents', () => {
    expect(slugify('Café Crème')).toBe('cafe-creme');
  });

  it('collapses separators and trims hyphens', () => {
    expect(slugify('  Hello,   World!  ')).toBe('hello-world');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('!!!')).toBe('');
  });
});

describe('truncate', () => {
  it('leaves short text untouched', () => {
    expect(truncate('abc', 5)).toBe('abc');
  });

  it('truncates within the limit including the ellipsis', () => {
    const result = truncate('abcdefghij', 5);
    expect(result).toBe('abcd…');
    expect(Array.from(result)).toHaveLength(5);
  });

  it('does not split emoji', () => {
    expect(truncate('😀😀😀😀', 3)).toBe('😀😀…');
  });

  it('handles tiny limits', () => {
    expect(truncate('abc', 0)).toBe('');
    expect(truncate('abc', 1)).toBe('…');
  });
});

describe('capitalize', () => {
  it('uppercases only the first character', () => {
    expect(capitalize('hello World')).toBe('Hello World');
    expect(capitalize('')).toBe('');
  });
});

describe('normalizeWhitespace', () => {
  it('collapses whitespace runs and trims', () => {
    expect(normalizeWhitespace('  a \n\t b  ')).toBe('a b');
  });
});

describe('stripHtml', () => {
  it('removes tags and normalizes whitespace', () => {
    expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });
});

describe('escapeHtml', () => {
  it('escapes significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });
});

describe('isBlank', () => {
  it('treats null, undefined, empty, and whitespace as blank', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank('  \n')).toBe(true);
    expect(isBlank(' a ')).toBe(false);
  });
});
