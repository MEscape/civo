import { Children, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

import enBooking from '@modules/booking/presentation/i18n/en.json';

type Component = (props: unknown) => ReactNode | Promise<ReactNode>;

const isAsync = (type: unknown): type is Component =>
  typeof type === 'function' && type.constructor.name === 'AsyncFunction';

/** The props that hold a piece of the page (a footer, a header), as opposed to a value. */
async function resolveElementProps(props: Record<string, unknown>) {
  const entries = await Promise.all(
    Object.entries(props)
      .filter(([key, value]) => key !== 'children' && isValidElement(value))
      .map(async ([key, value]) => [key, await resolveServerTree(value as ReactNode)] as const),
  );
  return Object.fromEntries(entries);
}

/**
 * Resolves the async Server Components inside an element tree, children first, so a page made of
 * them can be rendered by the client test renderer, which cannot suspend on them. The children and
 * the props that hold elements (a panel's footer) are followed.
 */
export async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) {
    return Promise.all(node.map((child) => resolveServerTree(child)));
  }
  if (!isValidElement(node)) {
    return node;
  }
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (isAsync(element.type)) {
    return resolveServerTree(await element.type(element.props));
  }
  const { children } = element.props;
  const resolvedChildren =
    children === undefined
      ? []
      : await Promise.all(Children.toArray(children).map(resolveServerTree));
  return cloneElement(element, await resolveElementProps(element.props), ...resolvedChildren);
}

/** Renders a Server Component (and the ones it contains) the way the English catalog words it. */
export async function renderServer(element: ReactNode, timeZone = 'Europe/Berlin') {
  const resolved = await resolveServerTree(element);
  return render(
    <NextIntlClientProvider locale="en" messages={enBooking} timeZone={timeZone}>
      {resolved}
    </NextIntlClientProvider>,
  );
}
