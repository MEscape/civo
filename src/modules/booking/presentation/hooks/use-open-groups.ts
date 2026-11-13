'use client';

import { useState } from 'react';

import type { ServiceGroupDto } from '../dto/service-dto';

/** What a group is called as an accordion value: services without a category share one. */
const NO_CATEGORY = '__none__';
export const groupKey = (group: ServiceGroupDto) => group.category ?? NO_CATEGORY;

/** The first categories start open so the page is not a wall of closed rows; the rest are one press away. */
const OPEN_AT_START = 2;

/** Which categories are expanded, and opening or closing all at once. Only a view: nothing is stored. */
export function useOpenGroups(groups: readonly ServiceGroupDto[]) {
  const [open, setOpen] = useState<string[]>(() => groups.slice(0, OPEN_AT_START).map(groupKey));
  const isAllOpen = open.length === groups.length;

  return {
    open,
    setOpen,
    isAllOpen,
    toggleAll: () => {
      setOpen(isAllOpen ? [] : groups.map(groupKey));
    },
  };
}
