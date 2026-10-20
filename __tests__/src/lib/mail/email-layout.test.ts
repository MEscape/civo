import { describe, expect, it } from 'vitest';

import { PLATFORM_EMAIL_BRAND, createEmailBrand, renderEmail } from '@lib/mail';

const WEBSITE = createEmailBrand({ primary: '#7a1f3d' });

describe('renderEmail', () => {
  const content = {
    locale: 'en',
    title: 'Hello <Ada>',
    intro: 'Intro & more',
    facts: [{ label: 'When', value: 'Today <now>' }],
    action: { label: 'Open', url: 'https://example.org/?a=1&b=2' },
    outro: 'Bye',
  } as const;

  it('escapes every dynamic value in the HTML and keeps the text plain', () => {
    const mail = renderEmail(content);

    expect(mail.subject).toBe('Hello <Ada>');
    expect(mail.html).toContain('Hello &lt;Ada&gt;');
    expect(mail.html).toContain('Intro &amp; more');
    expect(mail.html).toContain('Today &lt;now&gt;');
    expect(mail.html).toContain('href="https://example.org/?a=1&amp;b=2"');
    expect(mail.text).toBe(
      'Intro & more\n\nWhen: Today <now>\n\nOpen: https://example.org/?a=1&b=2\n\nBye',
    );
  });

  it('leaves out the facts and the button when there are none', () => {
    const mail = renderEmail({ locale: 'de', title: 'T', intro: 'I', outro: 'O' });

    expect(mail.text).toBe('I\n\nO');
    expect(mail.html).toContain('<html lang="de">');
    expect(mail.html).not.toContain('<a ');
    expect(mail.html).not.toContain('<table');
  });

  it('treats an explicitly absent action as none', () => {
    expect(
      renderEmail({ locale: 'en', title: 'T', intro: 'I', outro: 'O', action: null }).html,
    ).not.toContain('<a ');
  });

  it('escapes a language that would break out of its attribute', () => {
    const html = renderEmail({ locale: '"><script>', title: 'T', intro: 'I', outro: 'O' }).html;

    expect(html).not.toContain('<script>');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<b>',
    'ftp://example.org',
    '/relative',
    'not a url',
  ])('refuses to link to %j', (url) => {
    expect(() =>
      renderEmail({
        locale: 'en',
        title: 'T',
        intro: 'I',
        outro: 'O',
        action: { label: 'Go', url },
      }),
    ).toThrow('An e-mail action links to an http(s) address.');
  });
});

describe('the markup', () => {
  const content = {
    locale: 'en',
    title: 'Title',
    intro: 'The first line, shown beside the subject.',
    facts: [
      { label: 'Reference', value: 'AB12-CD34', style: 'code' },
      { label: 'When', value: 'Today' },
    ],
    action: { label: 'Open', url: 'https://example.org/x', note: 'Valid for an hour.' },
    outro: 'Why you got this.',
  } as const;

  /** An element's attributes, so `<img width>` (the image's own) is not mistaken for layout. */
  const withoutImages = (html: string) => html.replace(/<img\b[^>]*>/g, '');

  it('uses none of the presentational attributes HTML has retired', () => {
    const html = withoutImages(renderEmail(content).html);

    expect(html).not.toMatch(
      /\s(bgcolor|background|cellpadding|cellspacing|border|align|valign|width|height|color|face|size)=/,
    );
    expect(html).not.toMatch(/<(center|font|nobr)\b/);
  });

  it('builds the layout from divs and CSS, not from layout tables', () => {
    const { html } = renderEmail(content);

    expect(html).toContain('max-width: 560px');
    expect(html).toContain('margin: 0 auto');
    expect(html).not.toContain('role="presentation"');
    // The one table is the facts: tabular data, with each label the header of its row.
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(html).toContain('<th scope="row"');
  });

  it('gives the page a document structure: language, heading, article', () => {
    const { html } = renderEmail(content);

    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
    expect(html).toContain('<meta name="color-scheme" content="light">');
    expect(html).toContain('<title>Title</title>');
    expect(html).toContain('role="article"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
  });

  it('keeps the image’s own width and height, which reserve its space before it loads', () => {
    const { html } = renderEmail(content);

    expect(html).toMatch(
      /<img src="[^"]*\/email\/artemis-connect\.png" width="120" height="81" alt="Artemis Connect"/,
    );
  });

  it('puts the first line of the message in the inbox preview, hidden in the body', () => {
    const { html } = renderEmail(content);

    expect(html).toMatch(/display: none;[^>]*>The first line, shown beside the subject\./u);
  });

  it('keeps the heading as the subject unless the subject says it better', () => {
    expect(renderEmail(content).subject).toBe('Title');
    expect(renderEmail({ ...content, subject: 'Title: which one' }).subject).toBe(
      'Title: which one',
    );
  });

  it('draws a link styled as a button, a note beneath it and the link in words', () => {
    const { html, text } = renderEmail(content);

    expect(html).toMatch(
      /<a href="https:\/\/example\.org\/x" style="[^"]*display: inline-block[^"]*background-color: #1f3a34/,
    );
    expect(html).toContain('Valid for an hour.');
    expect(html).toContain('Button not working? Open this link:');
    expect(text).toContain('Open: https://example.org/x\nValid for an hour.');
  });

  it('shows a button without a note when there is none', () => {
    const html = renderEmail({
      ...content,
      action: { label: 'Go', url: 'https://example.org' },
    }).html;

    expect(html).toContain('>Go</a>');
    expect(html).not.toContain('margin: 12px 0 0 0');
  });

  it('sets a fact in a fixed-width face when it is a reference to copy, and only that one', () => {
    const { html } = renderEmail(content);

    expect(html.match(/letter-spacing: 0\.04em/g)).toHaveLength(1);
    expect(html).toContain('AB12-CD34');
  });

  it('never closes a style attribute early: no value carries a double quote', () => {
    for (const brand of [PLATFORM_EMAIL_BRAND, WEBSITE]) {
      const styles = [...renderEmail(content, brand).html.matchAll(/style="([^"]*)"/g)];

      expect(styles.length).toBeGreaterThan(10);
      expect(styles.every(([, style]) => !style?.includes('<'))).toBe(true);
    }
  });
});

describe('the brand in the markup', () => {
  const content = {
    locale: 'en',
    title: 'T',
    intro: 'I',
    action: { label: 'Go', url: 'https://example.org' },
    outro: 'O',
  } as const;

  it('puts the colour on the card edge and the button of the message', () => {
    const { html } = renderEmail(content, WEBSITE);

    expect(html).toContain('border-top: 4px solid #7a1f3d');
    expect(html).toContain('background-color: #7a1f3d');
  });

  it('draws the radius, spacing and fonts of the website', () => {
    const { html } = renderEmail(
      content,
      createEmailBrand({
        primary: '#7a1f3d',
        radius: 'lg',
        spacingScale: 'spacious',
        headingFont: 'Inter',
        bodyFont: 'DM Sans',
      }),
    );

    expect(html).toContain('border-radius: 12px');
    expect(html).toContain('padding: 40px');
    expect(html).toMatch(/<h1 style="[^"]*font-family: Inter,/);
    expect(html).toMatch(/<body style="[^"]*font-family: 'DM Sans',/);
  });

  it('is built from the platform theme alone: its colours are the identity’s and no others', () => {
    const colours = new Set(renderEmail(content).html.match(/#[0-9a-f]{6}/g));

    expect([...colours].sort()).toEqual(
      ['#1f3a34', '#2e2a24', '#5b564c', '#e4e0d5', '#f6f4ee', '#ffffff'].sort(),
    );
  });

  it('carries the company logo in platform mail and only a credit line in website mail', () => {
    const german = { ...content, locale: 'de' };
    const platform = renderEmail(german);
    const website = renderEmail(german, WEBSITE);

    expect(platform.html).toContain('/email/artemis-connect.png');
    expect(platform.html).toContain('Civo · Artemis Connect');
    expect(platform.html).not.toContain('Bereitgestellt mit');
    expect(website.html).not.toContain('/email/artemis-connect.png');
    expect(website.html).toContain('Bereitgestellt mit Artemis Connect');
    expect(website.text).toContain('Bereitgestellt mit Artemis Connect');
  });
});

describe('language', () => {
  const content = { title: 'T', intro: 'I', outro: 'O' };
  const action = { label: 'Go', url: 'https://example.org' };

  it('writes the link hint in the message’s language', () => {
    expect(renderEmail({ ...content, locale: 'de', action }).html).toContain(
      'Funktioniert die Schaltfläche nicht?',
    );
    expect(renderEmail({ ...content, locale: 'en', action }).html).toContain('Button not working?');
  });

  it.each(['fr', 'constructor', '__proto__'])(
    'gives a language without copy the German one (%s), never a prototype member',
    (locale) => {
      const html = renderEmail({ ...content, locale, action }, WEBSITE).html;

      expect(html).toContain('Funktioniert die Schaltfläche nicht?');
      expect(html).toContain('Bereitgestellt mit Artemis Connect');
    },
  );

  it('opens with the greeting, in text and HTML, when the message knows who it is for', () => {
    const mail = renderEmail({ ...content, locale: 'en', greeting: 'Hello <Ada>,' });

    expect(mail.text.startsWith('Hello <Ada>,\n\nI')).toBe(true);
    expect(mail.html).toContain('Hello &lt;Ada&gt;,');
  });
});
