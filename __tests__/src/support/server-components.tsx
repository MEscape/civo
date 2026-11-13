import { Children, cloneElement, isValidElement } from 'react';
import type { ReactNode } from 'react';

function isAsyncComponent(component: unknown): component is (props: unknown) => Promise<ReactNode> {
  return typeof component === 'function' && component.constructor.name === 'AsyncFunction';
}

/** Resolve async Server Components while leaving ordinary React components and hooks to React. */
export async function resolveServerComponents(node: ReactNode): Promise<ReactNode> {
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return node;
  }
  if (isAsyncComponent(node.type)) {
    return resolveServerComponents(await node.type(node.props));
  }
  // Slots other than children (a heading's `actions`, `meta`) can hold Server Components too.
  const slots = Object.fromEntries(
    await Promise.all(
      Object.entries(node.props)
        .filter(([key, value]) => key !== 'children' && isValidElement(value))
        .map(async ([key, value]) => [key, await resolveServerComponents(value)]),
    ),
  );
  if (node.props.children === undefined) {
    return Object.keys(slots).length === 0 ? node : cloneElement(node, slots);
  }
  const children = await Promise.all(
    Children.toArray(node.props.children).map(resolveServerComponents),
  );
  return cloneElement(node, slots, ...children);
}
