// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { brokenLinks, buildAiRules, listRuleFiles, rewriteLinks } from '../../scripts/lib/ai-rules';
import { CliError } from '../../scripts/lib/args';

let root: string;

function write(relative: string, content: string): void {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

/** An index in the shape of docs/rules/README.md: the diagram lists the files in order. */
function index(...files: string[]): string {
  return `# Rules\n\n\`\`\`mermaid\ngraph TD\n${files.map((file, i) => `  N${i}["${file}"]`).join('\n')}\n\`\`\`\n`;
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'ai-rules-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('listRuleFiles', () => {
  it('follows the order of the index, not the alphabet', () => {
    write('docs/rules/README.md', index('security.md', 'api.md'));
    write('docs/rules/api.md', '# api');
    write('docs/rules/security.md', '# security');

    expect(listRuleFiles(root)).toEqual(['security.md', 'api.md']);
  });

  it('lists a file once, however often the index mentions it', () => {
    write('docs/rules/README.md', index('api.md', 'api.md'));
    write('docs/rules/api.md', '# api');

    expect(listRuleFiles(root)).toEqual(['api.md']);
  });

  it('stops on a rule file the index does not list and on an entry without a file', () => {
    write('docs/rules/README.md', index('api.md', 'gone.md'));
    write('docs/rules/api.md', '# api');
    write('docs/rules/new.md', '# new');

    expect(() => listRuleFiles(root)).toThrow(CliError);
    expect(() => listRuleFiles(root)).toThrow(/does not list: new\.md/);
    expect(() => listRuleFiles(root)).toThrow(/missing: gone\.md/);
  });
});

describe('rewriteLinks', () => {
  it.each([
    ['[x](boundaries.md)', '[x](docs/rules/boundaries.md)'],
    ['[x](boundaries.md#layers)', '[x](docs/rules/boundaries.md#layers)'],
    ['[x](../architecture/audit.md)', '[x](docs/architecture/audit.md)'],
    ['[x](../conventions/adding-a-module.md)', '[x](docs/conventions/adding-a-module.md)'],
  ])('resolves %s from the repository root', (before, after) => {
    expect(rewriteLinks(before)).toBe(after);
  });

  it('leaves absolute addresses, mail links and in-page anchors alone', () => {
    const text = '[a](https://example.org/x.md) [b](mailto:a@b.c) [c](#anchor) [d](image.png)';

    expect(rewriteLinks(text)).toBe(text);
  });
});

describe('brokenLinks', () => {
  it('names the links whose target is no file under the root', () => {
    write('docs/rules/api.md', '# api');

    expect(brokenLinks('[ok](docs/rules/api.md) [bad](docs/rules/none.md)', root)).toEqual([
      'docs/rules/none.md',
    ]);
  });
});

describe('buildAiRules', () => {
  it('consolidates the rules in index order, with their links rewritten and the broken ones reported', async () => {
    write('docs/rules/README.md', index('b.md', 'a.md'));
    write('docs/rules/a.md', '# A\n\n- See [b](b.md).\n');
    write('docs/rules/b.md', '# B\n\n- See [gone](../architecture/gone.md).\n');

    const { content, ruleFileCount, brokenLinks: broken } = await buildAiRules(root);

    expect(ruleFileCount).toBe(2);
    expect(content.indexOf('Source: docs/rules/b.md')).toBeLessThan(
      content.indexOf('Source: docs/rules/a.md'),
    );
    expect(content).toContain('[b](docs/rules/b.md)');
    expect(content).not.toContain('\r');
    expect(broken).toEqual([
      'docs/rules/b.md links to docs/architecture/gone.md, which does not exist',
    ]);
  });
});
