import { describe, expect, it } from 'vitest';

import {
  capitalize,
  decodeHtmlEntities,
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

describe('decodeHtmlEntities', () => {
  it('decodes named entities', () => {
    expect(decodeHtmlEntities('Unter dem Motto &quot;Marktleben um 1525&quot;')).toBe(
      'Unter dem Motto "Marktleben um 1525"',
    );
    expect(decodeHtmlEntities('Information &amp; Ticket Service')).toBe(
      'Information & Ticket Service',
    );
    expect(decodeHtmlEntities('K&ouml;ln und D&uuml;sseldorf')).toBe('Köln und Düsseldorf');
  });

  it('decodes decimal and hex entities', () => {
    expect(decodeHtmlEntities('&#34;W&uuml;rzburg&#34; &#x26; Bayern')).toBe('"Würzburg" & Bayern');
  });
});

describe('stripHtml', () => {
  it('removes tags and normalizes whitespace', () => {
    expect(stripHtml('<p>Hello <b>World</b></p>')).toBe('Hello World');
  });

  it('inserts space between block elements so words do not collide', () => {
    expect(stripHtml('<p>Erster Absatz</p><p>Zweiter Absatz</p>')).toBe(
      'Erster Absatz Zweiter Absatz',
    );
    expect(stripHtml('Zeile 1<br/>Zeile 2<hr/>Zeile 3')).toBe('Zeile 1 Zeile 2 Zeile 3');
  });

  it('removes script and style tags completely', () => {
    expect(
      stripHtml('<style>body { color: red; }</style><p>Text</p><script>alert(1);</script>'),
    ).toBe('Text');
  });

  it('decodes HTML entities in stripped content', () => {
    const raw =
      '<p>Unter dem Motto &quot;Marktleben um 1525&quot; entf&uuml;hrt der Markt...</p><p>Tourist &amp; Ticket Service</p>';
    expect(stripHtml(raw)).toBe(
      'Unter dem Motto "Marktleben um 1525" entführt der Markt... Tourist & Ticket Service',
    );
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
