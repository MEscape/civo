import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { format, resolveConfig } from 'prettier';

import { CliError } from './args';

/** The canonical rules: one file per concern. Their order is the index in `README.md`. */
const RULES_DIR = 'docs/rules';
const INDEX_FILE = 'README.md';
export const OUTPUT_FILE = 'AI_RULES.md';

/** `["boundaries.md"]` in the index's diagram: the file names, in the order the index lists them. */
const INDEX_ENTRY = /\["([a-z0-9-]+\.md)"\]/g;

/** A relative link to another Markdown file, with an optional `#fragment`. */
const RELATIVE_MD_LINK = /\]\((?!https?:\/\/|mailto:|#)([^)#\s]+\.md)(#[^)]*)?\)/g;

const SEPARATOR = '\n\n---\n\n';

const HEADER = `# AI Engineering Rules

> GENERATED FILE — DO NOT EDIT BY HAND.
>
> Canonical sources: \`${RULES_DIR}/*.md\`
>
> Regenerate with \`npm run ai-rules\` after changing canonical rules.
>
> If this file conflicts with a canonical rule file, the canonical file takes precedence.`;

function readText(root: string, relative: string): string {
  return readFileSync(path.join(root, relative), 'utf8').replace(/\r\n/g, '\n');
}

/**
 * The rule files in the order `docs/rules/README.md` lists them. The index is the only list: a rule
 * file the index does not mention, or an entry without a file, stops the generation rather than
 * being skipped (CLAUDE.md: update the index when a rule file is added, renamed or removed).
 */
export function listRuleFiles(root: string): string[] {
  const listed = [
    ...new Set(
      [...readText(root, `${RULES_DIR}/${INDEX_FILE}`).matchAll(INDEX_ENTRY)].map(
        (match) => match[1] ?? '',
      ),
    ),
  ];
  const present = readdirSync(path.join(root, RULES_DIR)).filter(
    (name) => name.endsWith('.md') && name !== INDEX_FILE,
  );

  const missing = listed.filter((name) => !present.includes(name));
  const unlisted = present.filter((name) => !listed.includes(name));
  if (missing.length > 0 || unlisted.length > 0) {
    throw new CliError(
      [
        `${RULES_DIR}/${INDEX_FILE} and the rule files disagree.`,
        ...missing.map((name) => `  listed in the index but missing: ${name}`),
        ...unlisted.map((name) => `  a rule file the index does not list: ${name}`),
      ].join('\n'),
    );
  }
  return listed;
}

/**
 * Rewrites the relative Markdown links of a rule file so they resolve from the repository root,
 * where the consolidated document lives: `../architecture/x.md` becomes `docs/architecture/x.md`,
 * `boundaries.md` becomes `docs/rules/boundaries.md`.
 */
export function rewriteLinks(content: string): string {
  return content.replace(
    RELATIVE_MD_LINK,
    (_match, target: string, fragment: string | undefined) =>
      `](${path.posix.normalize(path.posix.join(RULES_DIR, target))}${fragment ?? ''})`,
  );
}

/** The links of `content` (already rewritten) whose target is not a file under `root`. */
export function brokenLinks(content: string, root: string): string[] {
  return [...content.matchAll(RELATIVE_MD_LINK)]
    .map((match) => match[1] ?? '')
    .filter((target) => !existsSync(path.join(root, target)));
}

export interface AiRules {
  /** The file's content, formatted with the repository's Prettier configuration so `format:check` accepts it. */
  readonly content: string;
  readonly ruleFileCount: number;
  /** One line per link in a rule file whose target does not exist. The document is built regardless. */
  readonly brokenLinks: readonly string[];
}

/** `AI_RULES.md`, built from the canonical rules. */
export async function buildAiRules(root: string): Promise<AiRules> {
  const files = listRuleFiles(root);
  const broken: string[] = [];

  const sections = files.map((file) => {
    const content = rewriteLinks(readText(root, `${RULES_DIR}/${file}`)).trim();
    for (const target of brokenLinks(content, root)) {
      broken.push(`${RULES_DIR}/${file} links to ${target}, which does not exist`);
    }
    return `# Source: ${RULES_DIR}/${file}\n\n${content}`;
  });

  const outputPath = path.join(root, OUTPUT_FILE);
  const options = (await resolveConfig(outputPath)) ?? {};
  const content = await format([HEADER, ...sections].join(SEPARATOR), {
    ...options,
    filepath: outputPath,
  });
  return { content, ruleFileCount: files.length, brokenLinks: broken };
}

/** The current `AI_RULES.md`, or `null` when there is none. */
export function currentAiRules(root: string): string | null {
  return existsSync(path.join(root, OUTPUT_FILE)) ? readText(root, OUTPUT_FILE) : null;
}
