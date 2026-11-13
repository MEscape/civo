import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fitTabs, isCurrent, useSectionNav } from '@hooks/use-section-nav';

afterEach(() => vi.unstubAllGlobals());

describe('useSectionNav', () => {
  it('moves overflow and grouped sections together, uses compact navigation when needed, and releases observation', async () => {
    let notify = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class implements ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          notify = () => {
            callback([], this);
          };
        }
        observe() {}
        unobserve() {}
        disconnect = disconnect;
      },
    );
    let available = 500;
    const area = document.createElement('div');
    Object.defineProperty(area, 'clientWidth', { get: () => available });
    const measure = document.createElement('ul');
    for (const width of [100, 100, 100, 80, 70]) {
      const item = document.createElement('li');
      Object.defineProperty(item, 'offsetWidth', { get: () => width });
      measure.append(item);
    }
    const links = [
      { href: '/', label: 'Brand', isBrand: true },
      { href: '/a', label: 'A' },
      { href: '/b', label: 'B' },
      { href: '/c', label: 'C' },
      { href: '/users', label: 'Users', group: 'Administration' },
    ];
    const areaRef = { current: area };
    const measureRef = { current: measure };
    const { result, unmount } = renderHook(() =>
      useSectionNav(
        { label: 'Sections', moreLabel: 'More', links, pathname: '/b/edit' },
        areaRef,
        measureRef,
      ),
    );
    await act(async () => {
      notify();
    });
    expect(result.current.brand.map((link) => link.label)).toEqual(['Brand']);
    expect(result.current.shown.map((link) => link.label)).toEqual(['A', 'B', 'C']);
    expect(result.current.overflowMenu).toMatchObject({ label: 'Administration' });
    available = 350;
    await act(async () => {
      notify();
    });
    expect(result.current.shown.map((link) => link.label)).toEqual(['A', 'B']);
    expect(result.current.overflowMenu).toMatchObject({
      label: 'More',
      links: [{ label: 'C' }, { label: 'Users' }],
    });
    expect(result.current.isCompact).toBe(false);
    available = 180;
    await act(async () => {
      notify();
    });
    expect(result.current.isCompact).toBe(true);
    expect(result.current.current?.label).toBe('B');
    expect(result.current.sections.map((link) => link.label)).toEqual(['A', 'B', 'C', 'Users']);
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('keeps every destination in a compact menu before width measurement, preventing initial overflow', () => {
    const { result } = renderHook(() =>
      useSectionNav(
        { label: 'Sections', links: [{ href: '/a', label: 'A' }], pathname: null },
        { current: null },
        { current: null },
      ),
    );
    expect(result.current.shown).toEqual([]);
    expect(result.current.isCompact).toBe(true);
    expect(result.current.sections.map((link) => link.label)).toEqual(['A']);
    expect(result.current.current).toBeUndefined();
    expect(result.current.overflowMenu).toMatchObject({
      label: 'Sections',
      links: [{ label: 'A' }],
    });
  });
});

describe('navigation current-link matching', () => {
  it('matches the destination and its descendants along whole path segments', () => {
    const link = { href: '/pages', label: 'Pages' };
    expect(isCurrent('/pages', link)).toBe(true);
    expect(isCurrent('/pages/home', link)).toBe(true);
    expect(isCurrent('/pages-other', link)).toBe(false);
  });

  it('honors exact links and never marks a brand or an unknown path current', () => {
    expect(isCurrent('/pages/home', { href: '/pages', label: 'Pages', isExact: true })).toBe(false);
    expect(isCurrent('/pages', { href: '/pages', label: 'Pages', isExact: true })).toBe(true);
    expect(isCurrent('/pages', { href: '/pages', label: 'Brand', isBrand: true })).toBe(false);
    expect(isCurrent(null, { href: '/pages', label: 'Pages' })).toBe(false);
  });
});

describe('fitTabs', () => {
  const measures = { tabs: [100, 100, 100], gap: 24, group: 80, more: 70 };

  it('keeps every tab when it fits beside the administration group', () => {
    expect(fitTabs(452, measures)).toBe(3);
  });

  it('reserves room for More before choosing which tabs overflow', () => {
    expect(fitTabs(350, measures)).toBe(2);
    expect(fitTabs(250, measures)).toBe(1);
    expect(fitTabs(180, measures)).toBe(0);
  });

  it('handles empty navigation and a bar without an administration group', () => {
    expect(fitTabs(0, { tabs: [], gap: 24, group: 0, more: 70 })).toBe(0);
    expect(fitTabs(500, { ...measures, group: 0 })).toBe(3);
  });

  it('keeps every tab at an exact fit without reserving a nonexistent trailing gap', () => {
    expect(fitTabs(348, { ...measures, group: 0 })).toBe(3);
  });
});
