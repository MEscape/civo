import { describe, expect, it } from 'vitest';

import { threeWayMergeProps } from '@modules/release/domain/migration/three-way-merge';

describe('threeWayMergeProps domain logic', () => {
  it('merges cleanly when only local has changed', () => {
    const base = { title: 'Base Title', color: 'blue' };
    const local = { title: 'Custom Local Title', color: 'blue' };
    const next = { title: 'Base Title', color: 'blue' };

    const result = threeWayMergeProps(base, local, next);
    expect(result.conflicts).toHaveLength(0);
    expect(result.addedFields).toHaveLength(0);
    expect(result.merged).toEqual({
      title: 'Custom Local Title',
      color: 'blue',
    });
  });

  it('merges cleanly when only next has changed', () => {
    const base = { title: 'Base Title', color: 'blue' };
    const local = { title: 'Base Title', color: 'blue' };
    const next = { title: 'Base Title', color: 'red' };

    const result = threeWayMergeProps(base, local, next);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toEqual({
      title: 'Base Title',
      color: 'red',
    });
  });

  it('merges cleanly when both local and next changed to identical values', () => {
    const base = { title: 'Base Title' };
    const local = { title: 'Same Value' };
    const next = { title: 'Same Value' };

    const result = threeWayMergeProps(base, local, next);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toEqual({ title: 'Same Value' });
  });

  it('detects both_changed conflict when local and next differ from base and each other', () => {
    const base = { title: 'Base Title' };
    const local = { title: 'Local Edit' };
    const next = { title: 'Upstream Update' };

    const result = threeWayMergeProps(base, local, next);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toEqual({
      kind: 'both_changed',
      key: 'title',
      base: 'Base Title',
      local: 'Local Edit',
      incoming: 'Upstream Update',
    });
    // Keeps local until human decision
    expect(result.merged['title']).toBe('Local Edit');
  });

  it('silently removes a field dropped upstream when local never customized it', () => {
    const base = { deprecated: 'default', title: 'Header' };
    const local = { deprecated: 'default', title: 'Header' };
    const next = { title: 'Header' };

    const result = threeWayMergeProps(base, local, next);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged).toEqual({ title: 'Header' });
  });

  it('detects removed_upstream conflict when editor had customized the dropped field', () => {
    const base = { subtitle: 'Old Default', title: 'Main' };
    const local = { subtitle: 'Custom Subtitle', title: 'Main' };
    const next = { title: 'Main' }; // subtitle dropped in next

    const result = threeWayMergeProps(base, local, next);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toEqual({
      kind: 'removed_upstream',
      key: 'subtitle',
      base: 'Old Default',
      local: 'Custom Subtitle',
    });
    // Dropped from merged props to avoid writing dead field
    expect(result.merged['subtitle']).toBeUndefined();
  });

  it('detects newly added fields in next version', () => {
    const base = { title: 'Main' };
    const local = { title: 'Main' };
    const next = { title: 'Main', newLayoutSetting: 'grid' };

    const result = threeWayMergeProps(base, local, next);
    expect(result.conflicts).toHaveLength(0);
    expect(result.addedFields).toEqual(['newLayoutSetting']);
    expect(result.merged).toEqual({
      title: 'Main',
      newLayoutSetting: 'grid',
    });
  });
});
