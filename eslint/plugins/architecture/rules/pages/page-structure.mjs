import { classifyContext, defineRule, report } from '../../util.mjs';

/** What a page's content component may do before it hands over to the module's screen. */
const MAX_CONTENT_STATEMENTS = 8;

const isFunction = (node) =>
  node?.type === 'FunctionDeclaration' ||
  node?.type === 'FunctionExpression' ||
  node?.type === 'ArrowFunctionExpression';

/** The JSX element a function returns, when it returns exactly one (directly or in parentheses). */
function returnedElement(fn) {
  if (fn.body.type !== 'BlockStatement') return fn.body.type === 'JSXElement' ? fn.body : null;
  const returns = fn.body.body.filter((statement) => statement.type === 'ReturnStatement');
  const last = returns.at(-1)?.argument;
  return last?.type === 'JSXElement' ? last : null;
}

const nameOf = (element) =>
  element.openingElement.name.type === 'JSXIdentifier' ? element.openingElement.name.name : null;

/**
 * A protected route page is a small wrapper, the way media's and audit's are: a default export that
 * returns `<Suspense fallback={<…Skeleton />}>` around one local `async` content component, which
 * resolves the route's params and hands them to the module's screen. The loading, the framing and
 * every decision live in the module (`<Thing>Administration` and its loader), so a page never grows
 * into a second place where a screen is built.
 */
export const pageStructure = defineRule({
  description:
    'Protected route pages are a Suspense wrapper around one small async content component that mounts a module screen.',
  create(context) {
    const { repoPath, file } = classifyContext(context);
    if (
      file.area !== 'app' ||
      !repoPath.endsWith('/page.tsx') ||
      !repoPath.includes('/(protected)/')
    ) {
      return {};
    }

    const functions = new Map();
    let defaultExport = null;

    return {
      FunctionDeclaration(node) {
        if (node.id && node.parent.type === 'Program') functions.set(node.id.name, node);
        if (node.id && node.parent.type === 'ExportNamedDeclaration')
          functions.set(node.id.name, node);
      },
      ExportDefaultDeclaration(node) {
        defaultExport = node.declaration;
      },
      'Program:exit'() {
        if (!isFunction(defaultExport)) {
          return;
        }
        const wrapper = returnedElement(defaultExport);
        if (wrapper === null || nameOf(wrapper) !== 'Suspense') {
          report(
            context,
            defaultExport,
            'A protected page returns <Suspense fallback={<…Skeleton />}> around its content, so the route streams (docs/rules/nextjs.md). Its content is a local async component that mounts a module screen.',
          );
          return;
        }
        const hasFallback = wrapper.openingElement.attributes.some(
          (attribute) => attribute.type === 'JSXAttribute' && attribute.name.name === 'fallback',
        );
        if (!hasFallback) {
          report(
            context,
            wrapper,
            '<Suspense> needs a `fallback` that looks like the page (a skeleton from components/skeletons).',
          );
        }
        const child = wrapper.children.find((candidate) => candidate.type === 'JSXElement');
        const contentName = child === undefined ? null : nameOf(child);
        const content = contentName === null ? undefined : functions.get(contentName);
        if (content === undefined || !content.async) {
          report(
            context,
            wrapper,
            "Put the page's content in a local `async function …Content(props)` and render it inside <Suspense>: params and searchParams are awaited there, not in the default export.",
          );
          return;
        }
        const statements = content.body.body.length;
        if (statements > MAX_CONTENT_STATEMENTS) {
          report(
            context,
            content,
            `The page's content component has ${String(statements)} statements (at most ${String(MAX_CONTENT_STATEMENTS)}). Move the loading and the framing into the module's <Thing>Administration and its loader (see MediaAdministration, AuditAdministration).`,
          );
        }
      },
    };
  },
});
