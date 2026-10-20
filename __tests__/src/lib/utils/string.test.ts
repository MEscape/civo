import { describe, expect, it } from 'vitest';

import {
  decodeHtmlEntities,
  escapeHtml,
  isBlank,
  normalizeWhitespace,
  slugify,
  stripHtml,
  trimToNull,
  truncate,
} from '@lib/utils/string';

describe('slugify', () => {
  it('transliterates German characters', () => {
    expect(slugify('Bürgerbüro Größe Äpfel')).toBe('buergerbuero-groesse-aepfel');
  });

  it('transliterates the other Latin letters that do not decompose', () => {
    expect(slugify('Ærø Œuvre Øl Åland Łódź Đakovo')).toBe('aero-oeuvre-ol-aland-lodz-dakovo');
  });

  it('strips other accents', () => {
    expect(slugify('Café Crème')).toBe('cafe-creme');
  });

  it('collapses separators and trims hyphens', () => {
    expect(slugify('  Hello,   World!  ')).toBe('hello-world');
    expect(slugify('--a--b--')).toBe('a-b');
  });

  it('keeps digits', () => {
    expect(slugify('Route 66')).toBe('route-66');
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('')).toBe('');
    expect(slugify('日本語')).toBe('');
  });
});

describe('truncate', () => {
  it('leaves short text untouched', () => {
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate('abcde', 5)).toBe('abcde');
  });

  it('truncates within the limit including the ellipsis', () => {
    const result = truncate('abcdefghij', 5);
    expect(result).toBe('abcd…');
    expect(Array.from(result)).toHaveLength(5);
  });

  it('drops whitespace left before the ellipsis', () => {
    expect(truncate('Hello world', 7)).toBe('Hello…');
  });

  it('does not split emoji', () => {
    expect(truncate('😀😀😀😀', 3)).toBe('😀😀…');
  });

  it('handles tiny limits', () => {
    expect(truncate('abc', 0)).toBe('');
    expect(truncate('abc', -4)).toBe('');
    expect(truncate('abc', 1)).toBe('…');
  });
});

describe('normalizeWhitespace', () => {
  it('collapses whitespace runs and trims', () => {
    expect(normalizeWhitespace('  a \n\t b  ')).toBe('a b');
  });

  it('treats a non-breaking space as whitespace', () => {
    expect(normalizeWhitespace('a  b')).toBe('a b');
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
    expect(decodeHtmlEntities('&#x1F600;')).toBe('😀');
  });

  it('leaves an unknown name and a code point beyond Unicode as written', () => {
    expect(decodeHtmlEntities('&notanentity; &#1114112; &#x110000;')).toBe(
      '&notanentity; &#1114112; &#x110000;',
    );
  });

  it('decodes a lone surrogate as the platform does', () => {
    expect(decodeHtmlEntities('&#xD800;')).toBe('\ud800');
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'does not find &%s; on the prototype chain',
    (name) => {
      expect(decodeHtmlEntities(`a &${name}; b`)).toBe(`a &${name}; b`);
    },
  );

  it('does not decode twice', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
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

  it('removes script and style whatever their case or attributes', () => {
    expect(stripHtml('<SCRIPT type="x">alert(1)</SCRIPT>after')).toBe('after');
    expect(stripHtml('<Style media="print">a{}</Style>after')).toBe('after');
  });

  it('keeps the content of a script or style that is never closed', () => {
    expect(stripHtml('<p>a</p><script>b')).toBe('a b');
    expect(stripHtml('<style>x{}')).toBe('x{}');
  });

  it('keeps a "<" that no ">" follows', () => {
    expect(stripHtml('1 < 2')).toBe('1 < 2');
  });

  it('works through several scripts, closed and not', () => {
    expect(stripHtml('<script>a</script>x<script>b</script>y<script>c')).toBe('x y c');
  });

  // The text comes from external data sources and is rendered on the server for every visitor, so
  // a hostile value must cost milliseconds, not the seconds a rescanning pattern takes.
  it.each([
    ['unclosed tags', '<'.repeat(200_000)],
    ['unclosed tag names', '<p'.repeat(100_000)],
    ['unclosed scripts', '<script>'.repeat(25_000)],
    ['unclosed styles', '<style>'.repeat(25_000)],
  ])('stays fast on %s', (_name, hostile) => {
    const startedAt = performance.now();

    stripHtml(hostile);

    expect(performance.now() - startedAt).toBeLessThan(500);
  });

  it('decodes HTML entities in stripped content', () => {
    const raw =
      '<p>Unter dem Motto &quot;Marktleben um 1525&quot; entf&uuml;hrt der Markt...</p><p>Tourist &amp; Ticket Service</p>';
    expect(stripHtml(raw)).toBe(
      'Unter dem Motto "Marktleben um 1525" entführt der Markt... Tourist & Ticket Service',
    );
  });

  it('is empty for empty input', () => {
    expect(stripHtml('')).toBe('');
  });
});

describe('escapeHtml', () => {
  it('escapes significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;',
    );
  });

  it('escapes an ampersand first, so nothing is escaped twice', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves plain text alone', () => {
    expect(escapeHtml('Bürgerbüro 24/7')).toBe('Bürgerbüro 24/7');
  });
});

describe('isBlank', () => {
  it('treats null, undefined, empty, and whitespace as blank', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank('')).toBe(true);
    expect(isBlank('  \n')).toBe(true);
    expect(isBlank(' a ')).toBe(false);
  });
});

describe('trimToNull', () => {
  it('trims the text', () => {
    expect(trimToNull('  a b  ')).toBe('a b');
  });

  it('is null when nothing is left or the input is absent', () => {
    expect(trimToNull('   ')).toBeNull();
    expect(trimToNull('')).toBeNull();
    expect(trimToNull(null)).toBeNull();
    expect(trimToNull(undefined)).toBeNull();
  });
});
