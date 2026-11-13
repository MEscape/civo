import { describe, expect, it } from 'vitest';

import { CANONICAL_TARGET_FIELDS } from '@modules/data-sources/application/contracts/data-source-constraints';
import { suggestAssignments } from '@modules/data-sources/presentation/forms/suggest-assignments';

const EVENT = CANONICAL_TARGET_FIELDS.Event;

function paths(...list: string[]) {
  return list.map((path) => ({ path }));
}

describe('suggestAssignments', () => {
  it('matches a field to the target of the same name', () => {
    expect(suggestAssignments(paths('title', 'description'), EVENT)).toEqual({
      title: 'title',
      description: 'description',
    });
  });

  it('ignores case, separators and the dot path in front of the name', () => {
    expect(suggestAssignments(paths('data.Start_Date', 'meta.end-date'), EVENT)).toEqual({
      'data.Start_Date': 'startDate',
      'meta.end-date': 'endDate',
    });
  });

  it('uses the usual alternative names', () => {
    expect(suggestAssignments(paths('name', 'url', 'venue', 'picture'), EVENT)).toEqual({
      name: 'title',
      url: 'href',
      venue: 'location',
      picture: 'imageUrl',
    });
  });

  it('prefers the exact name over an alternative', () => {
    expect(suggestAssignments(paths('name', 'title'), EVENT)).toEqual({ title: 'title' });
  });

  it('uses a field only once and gives a required target the first pick', () => {
    // `date` is an alternative for the required startDate; publishedAt-like targets must not steal it.
    expect(suggestAssignments(paths('date'), EVENT)).toEqual({ date: 'startDate' });
  });

  it('skips list positions in a path', () => {
    expect(suggestAssignments(paths('items.0.title'), EVENT)).toEqual({ 'items.0.title': 'title' });
  });

  it('suggests nothing when no name is familiar', () => {
    expect(suggestAssignments(paths('userId', 'zz'), EVENT)).toEqual({});
  });
});
