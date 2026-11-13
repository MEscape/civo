import { classifyContext, defineRule, moduleSpecifierVisitors, report } from '../../util.mjs';

const COMPOSITION_IMPORT = /(?:^|\/)modules\/[^/]+\/composition(?:\.[a-z]+)?$/;
const QUERY_COMMAND_EXPORT = /(?:Queries|Commands|UseCases)$/;

/**
 * Forbids ad-hoc module composition roots inside src/app/_lib.
 * Runtime composition of use cases, cross-module dependencies, and queries/commands belongs
 * in src/modules/<module>/composition.ts (docs/rules/boundaries.md:11, docs/rules/modules.md:14).
 */
export const noAppLibComposition = defineRule({
  description:
    'Forbid business module use-case composition and composition-root imports inside src/app/_lib.',
  create(context) {
    const { repoPath } = classifyContext(context);
    if (!repoPath.startsWith('src/app/_lib/')) return {};

    return {
      ...moduleSpecifierVisitors(({ node, specifier }) => {
        if (COMPOSITION_IMPORT.test(specifier)) {
          report(
            context,
            node,
            `src/app/_lib must not import module composition roots ('${specifier}'). Business module composition belongs in src/modules/<module>/composition.ts (docs/rules/boundaries.md).`,
          );
        }
      }),
      ExportNamedDeclaration(node) {
        if (node.declaration?.type === 'VariableDeclaration') {
          for (const decl of node.declaration.declarations) {
            if (decl.id.type === 'Identifier' && QUERY_COMMAND_EXPORT.test(decl.id.name)) {
              report(
                context,
                decl,
                `src/app/_lib must not act as a composition root exporting query/command suites ('${decl.id.name}'). Move runtime composition to src/modules/<module>/composition.ts (docs/rules/boundaries.md).`,
              );
            }
          }
        }
      },
    };
  },
});
