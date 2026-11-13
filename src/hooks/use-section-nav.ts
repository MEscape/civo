'use client';

import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

export interface AppNavLink {
  readonly href: string;
  readonly label: string;
  /** The first link usually names the app itself and is set larger. It is never marked current. */
  readonly isBrand?: boolean;
  /** Matches its own address only; by default a link is also current for what lies below it. */
  readonly isExact?: boolean;
  /** `section` only: the name of a dropdown the link sits in, after the tabs (e.g. administration). */
  readonly group?: string;
  /** Decides "current" itself, for a bar whose areas share address prefixes (a location's services sit below the locations). */
  readonly isActive?: boolean;
  /** Shown but not yet usable (a screen that needs a location before it can mean anything); `hint` says why. */
  readonly isDisabled?: boolean;
  readonly hint?: string;
}

/** Whether `link` is the page the reader is on, or a destination above it. */
export function isCurrent(
  pathname: string | null,
  { href, isBrand = false, isExact = false, isActive, isDisabled = false }: AppNavLink,
) {
  if (isDisabled) {
    return false;
  }
  if (isActive !== undefined) {
    return isActive && !isBrand;
  }
  const target = href.split('?')[0] ?? href;
  return (
    pathname !== null &&
    !isBrand &&
    (pathname === target || (!isExact && pathname.startsWith(`${target}/`)))
  );
}

interface TabMeasures {
  /** The width of each tab, in order. */
  readonly tabs: readonly number[];
  /** The space between two items of the bar. */
  readonly gap: number;
  /** The width of the trailing group's button (administration), or 0 when there is none. */
  readonly group: number;
  /** The width of the "more" button that takes what does not fit. */
  readonly more: number;
}

/**
 * How many tabs fit in `available` pixels, in order: all of them beside the
 * group's button when they can, else as many as fit beside the "more"
 * button, which then holds the rest and the group's links.
 */
export function fitTabs(available: number, measures: TabMeasures): number {
  const { tabs, gap, group, more } = measures;
  const widthOf = (count: number) =>
    tabs.slice(0, count).reduce((sum, width) => sum + width, 0) + gap * count;

  const trailingGap = group === 0 && tabs.length > 0 ? gap : 0;
  if (widthOf(tabs.length) + group - trailingGap <= available) {
    return tabs.length;
  }
  let count = Math.max(0, tabs.length - 1);
  while (count > 0 && widthOf(count) + more > available) {
    count -= 1;
  }
  return count;
}

/** Two tabs beside "more" are still a tab bar; fewer, and one dropdown naming the current section says more. */
const MIN_VISIBLE_TABS = 2;
/** `gap-6`, the space between the bar's items. */
const TAB_GAP_PX = 24;

interface SectionNavInput {
  /** Names the landmark; also what the dropdown says when no `moreLabel` is given. */
  readonly label: string;
  /** The dropdown that holds the tabs the bar has no room for. */
  readonly moreLabel?: string | undefined;
  readonly links: readonly AppNavLink[];
  /** `null` while the path is not known yet: nothing is marked current. */
  readonly pathname: string | null;
}

/**
 * Which of the website bar's tabs fit. An invisible copy of every item (`measureRef`) is measured
 * whenever the room (`areaRef`) changes; the caller owns both refs, since a ref handed back from a
 * hook cannot be read during render, and the tabs that do not fit, with the grouped links,
 * move into one dropdown. With too little room for even two tabs, `isCompact` says to use one
 * dropdown for all sections.
 */
export function useSectionNav(
  { label, moreLabel, links, pathname }: SectionNavInput,
  areaRef: RefObject<HTMLDivElement | null>,
  measureRef: RefObject<HTMLUListElement | null>,
) {
  const brand = links.filter((link) => link.isBrand === true);
  const sections = links.filter((link) => link.isBrand !== true);
  const tabs = sections.filter((link) => link.group === undefined);
  const grouped = sections.filter((link) => link.group !== undefined);
  const groupLabel = grouped[0]?.group;
  const current = sections.find((link) => isCurrent(pathname, link));

  // The server cannot measure this bar. Start compact so narrow screens never overflow before hydration.
  const [visibleCount, setVisibleCount] = useState(0);

  useLayoutEffect(() => {
    const area = areaRef.current;
    const measure = measureRef.current;
    if (area === null || measure === null) {
      return undefined;
    }
    // The observer reports once right away, then on every change of the room.
    const observer = new ResizeObserver(() => {
      const widths = [...measure.children].map((item) => (item as HTMLElement).offsetWidth);
      const more = widths.pop() ?? 0;
      const group = groupLabel === undefined ? 0 : (widths.pop() ?? 0);
      setVisibleCount(fitTabs(area.clientWidth, { tabs: widths, gap: TAB_GAP_PX, group, more }));
    });
    observer.observe(area);
    observer.observe(measure);
    return () => {
      observer.disconnect();
    };
  }, [areaRef, measureRef, tabs.length, groupLabel]);

  const overflow = [...tabs.slice(visibleCount), ...grouped];
  const overflowMenu =
    visibleCount === tabs.length
      ? groupLabel !== undefined && { label: groupLabel, links: grouped }
      : { label: moreLabel ?? label, links: overflow };

  return {
    brand,
    sections,
    tabs,
    groupLabel,
    current,
    isCompact: visibleCount < Math.min(MIN_VISIBLE_TABS, tabs.length),
    shown: tabs.slice(0, visibleCount),
    overflowMenu,
  };
}
