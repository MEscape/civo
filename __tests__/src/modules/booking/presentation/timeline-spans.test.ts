import { describe, expect, it } from 'vitest';

import {
  addSpan,
  clipToParents,
  moveSpan,
  rangesOf,
  removeSpan,
  resizeSpan,
  snap,
  spansOf,
  windowOf,
} from '@modules/booking/presentation/timeline/spans';
import type { Span } from '@modules/booking/presentation/timeline/spans';

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

describe('reading and writing times', () => {
  it('turns ranges into spans, earliest first, and leaves out what is not a time', () => {
    expect(
      spansOf([
        { start: '13:00', end: '17:00' },
        { start: '08:00', end: '12:00' },
        { start: 'nine', end: '10:00' },
        { start: '10:00', end: '10:00' },
      ]),
    ).toEqual([
      { start: h(8), end: h(12) },
      { start: h(13), end: h(17) },
    ]);
  });

  it('writes them back as the form holds them', () => {
    expect(rangesOf([{ start: h(8, 15), end: h(12) }])).toEqual([{ start: '08:15', end: '12:00' }]);
  });

  it('snaps to the quarter hour', () => {
    expect([snap(h(8, 7)), snap(h(8, 8)), snap(h(8, 22))]).toEqual([h(8), h(8, 15), h(8, 15)]);
  });
});

const lane = (spans: readonly Span[], parents: readonly Span[] | null = null) => ({
  spans,
  parents,
});

describe('moving a bar', () => {
  const day = [
    { start: h(8), end: h(12) },
    { start: h(13), end: h(17) },
  ];

  it('keeps its length and snaps', () => {
    expect(moveSpan(lane(day), 0, 40)[0]).toEqual({ start: h(8, 45), end: h(12, 45) });
  });

  it('stops at the neighbour instead of overlapping it', () => {
    expect(moveSpan(lane(day), 0, 600)[0]).toEqual({ start: h(9), end: h(13) });
  });

  it('stops at midnight', () => {
    expect(moveSpan(lane(day), 1, 600)[1]).toEqual({ start: h(20), end: h(24) });
  });

  it('cannot leave the parent stretch it sits in', () => {
    const parent = [{ start: h(8), end: h(18) }];
    expect(moveSpan(lane(day, parent), 1, 120)[1]).toEqual({ start: h(14), end: h(18) });
    expect(moveSpan(lane(day, parent), 0, -120)[0]).toEqual({ start: h(8), end: h(12) });
  });

  it('does nothing for a bar that is not there', () => {
    expect(moveSpan(lane(day), 5, 30)).toEqual(day);
  });
});

describe('resizing a bar', () => {
  const day = [
    { start: h(8), end: h(12) },
    { start: h(13), end: h(17) },
  ];

  it('moves one edge', () => {
    expect(resizeSpan(lane(day), 0, { edge: 'end', to: h(11, 40) })[0]).toEqual({
      start: h(8),
      end: h(11, 45),
    });
    expect(resizeSpan(lane(day), 1, { edge: 'start', to: h(14) })[1]).toEqual({
      start: h(14),
      end: h(17),
    });
  });

  it('keeps at least the shortest length', () => {
    expect(resizeSpan(lane(day), 0, { edge: 'end', to: h(7) })[0]).toEqual({
      start: h(8),
      end: h(8, 30),
    });
    expect(resizeSpan(lane(day), 0, { edge: 'start', to: h(12) })[0]).toEqual({
      start: h(11, 30),
      end: h(12),
    });
  });

  it('does not run into a neighbour or out of the parent', () => {
    expect(resizeSpan(lane(day), 0, { edge: 'end', to: h(15) })[0]).toEqual({
      start: h(8),
      end: h(13),
    });
    expect(
      resizeSpan(lane(day, [{ start: h(8), end: h(18) }]), 1, { edge: 'end', to: h(20) })[1],
    ).toEqual({
      start: h(13),
      end: h(18),
    });
  });
});

describe('adding a bar', () => {
  it('starts at the pointer, as long as asked and as long as fits', () => {
    expect(addSpan(lane([]), { at: h(9, 5), length: 120 })).toEqual([{ start: h(9), end: h(11) }]);
    expect(addSpan(lane([{ start: h(10), end: h(12) }]), { at: h(9), length: 240 })).toEqual([
      { start: h(9), end: h(10) },
      { start: h(10), end: h(12) },
    ]);
  });

  it('refuses a start inside a bar, outside the parent, or with no room', () => {
    const day = [{ start: h(9), end: h(12) }];
    expect(addSpan(lane(day), { at: h(10), length: 60 })).toBeNull();
    expect(addSpan(lane([], [{ start: h(8), end: h(18) }]), { at: h(6), length: 60 })).toBeNull();
    expect(addSpan(lane([{ start: h(9, 5), end: h(12) }]), { at: h(9), length: 60 })).toBeNull();
  });

  it('stays inside the parent stretch', () => {
    expect(addSpan(lane([], [{ start: h(8), end: h(18) }]), { at: h(17), length: 240 })).toEqual([
      { start: h(17), end: h(18) },
    ]);
  });
});

describe('removing and clipping', () => {
  it('removes by position', () => {
    expect(
      removeSpan(
        [
          { start: 0, end: 60 },
          { start: 120, end: 180 },
        ],
        0,
      ),
    ).toEqual([{ start: 120, end: 180 }]);
  });

  it('keeps only the part of a break inside the opening hours', () => {
    const open = [{ start: h(8), end: h(12) }];
    expect(
      clipToParents(
        [
          { start: h(11), end: h(13) },
          { start: h(14), end: h(15) },
          { start: h(7, 50), end: h(8, 5) },
        ],
        open,
      ),
    ).toEqual([{ start: h(11), end: h(12) }]);
  });
});

describe('the hours a week shows', () => {
  it('is a normal working day when nothing reaches beyond it', () => {
    expect(windowOf([])).toEqual({ start: h(7), end: h(19) });
    expect(windowOf([{ start: h(9), end: h(17) }])).toEqual({ start: h(7), end: h(19) });
  });

  it('grows to the earliest and latest hour with an hour to spare', () => {
    expect(windowOf([{ start: h(5), end: h(21) }])).toEqual({ start: h(4), end: h(22) });
  });

  it('never goes past the day', () => {
    expect(windowOf([{ start: 0, end: h(24) }])).toEqual({ start: 0, end: h(24) });
  });
});
