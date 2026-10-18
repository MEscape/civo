import { describe, expect, it } from 'vitest';

import type { AuditSubjects } from '@modules/audit';
import { subjectIdsOf } from '@modules/audit/domain/models/audit-subject';
import { factsOf, headlineOf } from '@modules/audit/presentation/components/audit-details';

describe('the things audit entries name', () => {
  it('collects each id once per kind, from every field that names one, and nothing else', () => {
    const ids = subjectIdsOf([
      { details: { pageId: 'p-1', version: 3 } },
      { details: { pageId: 'p-1', datasetId: 'd-1', changedFields: ['name'] } },
      { details: { releaseId: 'r-2', previousReleaseId: 'r-1', errorCode: null } },
      { details: { serviceId: '' } },
    ]);

    expect(Object.fromEntries(ids)).toEqual({
      page: ['p-1'],
      dataset: ['d-1'],
      release: ['r-2', 'r-1'],
    });
  });
});

describe('the details of an audit entry', () => {
  const subjects: AuditSubjects = {
    page: {
      'p-1': { state: 'found', name: 'Home', href: '/websites/w/builder/p-1' },
      'p-2': { state: 'gone' },
    },
    release: { 'r-6': { state: 'found', name: null, href: '/websites/w/releases/r-6' } },
  };

  it('names what an entry refers to as the reader may see it: named, gone, or not theirs', () => {
    const facts = factsOf({ pageId: 'p-1', datasetId: 'd-1' }, subjects);

    expect(facts).toEqual([
      expect.objectContaining({ field: 'pageId', kind: 'subject', view: subjects.page?.['p-1'] }),
      // Datasets were not looked up for this reader: no name, never a guess.
      expect.objectContaining({ field: 'datasetId', kind: 'subject', view: null }),
    ]);
    expect(headlineOf(facts)).toBe('Home');
    expect(headlineOf(factsOf({ pageId: 'p-2' }, subjects))).toBeNull();
  });

  it('names a release by the number its entry carries, and shows the number only there', () => {
    const facts = factsOf({ releaseId: 'r-6', releaseNumber: 6 }, subjects);

    expect(facts).toEqual([
      expect.objectContaining({ field: 'releaseId', kind: 'subject', number: 6 }),
    ]);
  });

  it('reads each value as its kind: known words with their tone, codes, counts and changed fields', () => {
    const facts = factsOf(
      {
        outcome: 'ERROR',
        errorCode: 'data_source.unreachable',
        nodeCount: 13,
        changedFields: ['name', 'description'],
        canonicalKind: 'Event',
        invitationId: 'inv-1',
      },
      subjects,
    );

    expect(facts).toEqual([
      expect.objectContaining({
        kind: 'value',
        value: 'details.values.outcome.error',
        tone: 'danger',
      }),
      expect.objectContaining({ kind: 'code', value: 'data_source.unreachable' }),
      expect.objectContaining({ kind: 'number', value: 13 }),
      expect.objectContaining({ kind: 'changed', names: ['name', 'description'] }),
      expect.objectContaining({
        kind: 'text',
        value: 'Event',
        label: 'details.fields.canonicalKind',
      }),
    ]);
  });

  it('leaves out empty values and keeps an unknown field under its own name', () => {
    const facts = factsOf({ errorCode: null, outcome: 'OK', somethingNew: 'x' }, subjects);

    expect(facts).toEqual([
      expect.objectContaining({ field: 'outcome', tone: 'success' }),
      expect.objectContaining({ field: 'somethingNew', label: null, kind: 'text', value: 'x' }),
    ]);
  });
});
