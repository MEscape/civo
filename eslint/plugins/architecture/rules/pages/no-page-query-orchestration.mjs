import { classifyContext, defineRule, report } from '../../util.mjs';

/**
 * Route pages under src/app/** /page.tsx must not orchestrate multi-step data loading pipelines
 * (e.g., executing multiple queries or use cases).
 * Complex multi-query screens must mount a module Server Component (e.g. UsersAdministration,
 * AuditAdministration) backed by a loader (docs/rules/nextjs.md:6).
 */
export const noPageQueryOrchestration = defineRule({
  description: 'Forbid route pages from orchestrating multiple use cases or queries directly.',
  create(context) {
    const { repoPath, file } = classifyContext(context);
    if (file.area !== 'app' || !repoPath.endsWith('/page.tsx')) return {};

    const executeCalls = [];

    return {
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          !node.callee.computed &&
          node.callee.property.type === 'Identifier' &&
          node.callee.property.name === 'execute'
        ) {
          executeCalls.push(node);
        }
      },
      'Program:exit'() {
        if (executeCalls.length > 1) {
          for (const node of executeCalls) {
            report(
              context,
              node,
              `Route page '${repoPath}' must not orchestrate multi-step queries (${executeCalls.length} calls to .execute). Complex multi-query screens must mount a module Server Component (e.g. <UsersAdministration />, <AuditAdministration />) backed by a loader (docs/rules/nextjs.md).`,
            );
          }
        }
      },
    };
  },
});
