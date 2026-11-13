import { classifyContext, defineRule, report } from '../../util.mjs';

const TRUNCATION_PARAM = /^(?:limit|maxItems)$/;
const TRUNCATION_PROP = /^is(?:[A-Z].*)?Truncated$/;
const WAIVER_TAG = /@truncation\s+(?:none|waived)\s+\S+/;

function hasTruncationWaiver(context, node) {
  // Check comments on the node or preceding comments
  const comments = context.sourceCode.getCommentsBefore(node);
  if (comments.some((c) => WAIVER_TAG.test(c.value))) return true;
  // Also check all file-level comments
  return context.sourceCode.getAllComments().some((c) => WAIVER_TAG.test(c.value));
}

function hasTruncationType(typeNode) {
  if (!typeNode) return false;
  let found = false;

  function walk(n) {
    if (!n || found) return;
    if (n.type === 'Identifier') {
      if (TRUNCATION_PROP.test(n.name) || n.name === 'Page') {
        found = true;
        return;
      }
    }
    for (const key of Object.keys(n)) {
      if (key === 'parent') continue;
      const child = n[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object') walk(item);
        }
      } else if (child && typeof child === 'object') {
        walk(child);
      }
    }
  }

  walk(typeNode);
  return found;
}

/**
 * Enforces truncation signaling across the stack:
 * 1. Domain ports accepting a limit parameter must return an `isTruncated: boolean` flag in their contract.
 * 2. Presentation components that access or destructure truncation flags must render them in JSX warnings/alerts.
 *
 * Opt out when deliberately omitting truncation signals with: `// @truncation none <reason>`.
 * See docs/rules/performance.md.
 */
export const truncationSignal = defineRule({
  description:
    'Require bounded port methods to return an isTruncated flag and presentation components to render status warnings for it.',
  create(context) {
    const { file } = classifyContext(context);
    const inPorts = file.area === 'module' && file.layer === 'domain' && file.dir === 'ports';
    const isComponent =
      ((file.area === 'module' && file.layer === 'presentation' && file.dir === 'components') ||
        file.area === 'app') &&
      file.path.endsWith('.tsx');

    if (!inPorts && !isComponent) return {};

    // For Ports: check interface methods accepting limit
    if (inPorts) {
      return {
        TSMethodSignature(node) {
          const hasLimit = node.params.some(
            (p) =>
              (p.type === 'Identifier' && TRUNCATION_PARAM.test(p.name)) ||
              (p.type === 'AssignmentPattern' &&
                p.left.type === 'Identifier' &&
                TRUNCATION_PARAM.test(p.left.name)),
          );
          if (!hasLimit) return;
          if (hasTruncationWaiver(context, node)) return;

          if (!hasTruncationType(node.returnType)) {
            report(
              context,
              node,
              `Bounded port method '${node.key?.name ?? 'method'}' accepting a limit must return an 'isTruncated: boolean' signal in its contract. If intentional, say why: // @truncation none <reason> (docs/rules/performance.md)`,
            );
          }
        },
        TSPropertySignature(node) {
          if (!node.typeAnnotation) return;
          const fnType =
            node.typeAnnotation.typeAnnotation.type === 'TSFunctionType'
              ? node.typeAnnotation.typeAnnotation
              : null;
          if (!fnType) return;
          const hasLimit = fnType.parameters.some(
            (p) => p.type === 'Identifier' && TRUNCATION_PARAM.test(p.name),
          );
          if (!hasLimit) return;
          if (hasTruncationWaiver(context, node)) return;

          if (!hasTruncationType(fnType.returnType)) {
            report(
              context,
              node,
              `Bounded port method '${node.key?.name ?? 'method'}' accepting a limit must return an 'isTruncated: boolean' signal in its contract. If intentional, say why: // @truncation none <reason> (docs/rules/performance.md)`,
            );
          }
        },
      };
    }

    // For Presentation Components: check truncation flag usage in JSX
    const declaredTruncationVars = new Map(); // name -> AST node
    const jsxReferencedVars = new Set();

    return {
      // Collect destructured or accessed truncation properties: e.g. { isTruncated } = ...
      Property(node) {
        if (
          node.key.type === 'Identifier' &&
          TRUNCATION_PROP.test(node.key.name) &&
          node.value.type === 'Identifier'
        ) {
          declaredTruncationVars.set(node.value.name, node);
        }
      },
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier' && TRUNCATION_PROP.test(node.id.name)) {
          declaredTruncationVars.set(node.id.name, node);
        }
      },
      // Track MemberExpression: view.isTruncated or trail.isMembersTruncated
      MemberExpression(node) {
        if (
          !node.computed &&
          node.property.type === 'Identifier' &&
          TRUNCATION_PROP.test(node.property.name)
        ) {
          // If inside JSX or JSX conditional expression, record it
          let ancestor = node.parent;
          while (ancestor) {
            if (
              ancestor.type === 'JSXElement' ||
              ancestor.type === 'JSXExpressionContainer' ||
              ancestor.type === 'JSXAttribute'
            ) {
              jsxReferencedVars.add(node.property.name);
              break;
            }
            ancestor = ancestor.parent;
          }
        }
      },
      // Track usage in JSX
      JSXExpressionContainer(node) {
        function checkUsage(n) {
          if (!n) return;
          if (n.type === 'Identifier' && TRUNCATION_PROP.test(n.name)) {
            jsxReferencedVars.add(n.name);
          }
          if (n.type === 'LogicalExpression' || n.type === 'BinaryExpression') {
            checkUsage(n.left);
            checkUsage(n.right);
          }
          if (n.type === 'UnaryExpression') {
            checkUsage(n.argument);
          }
          if (n.type === 'ConditionalExpression') {
            checkUsage(n.test);
          }
        }
        checkUsage(node.expression);
      },
      'Program:exit'() {
        if (hasTruncationWaiver(context, context.sourceCode.ast)) return;
        for (const [name, node] of declaredTruncationVars.entries()) {
          if (!jsxReferencedVars.has(name)) {
            report(
              context,
              node,
              `Truncation signal '${name}' is accessed but not rendered in a status alert or conditional warning. (docs/rules/performance.md)`,
            );
          }
        }
      },
    };
  },
});
