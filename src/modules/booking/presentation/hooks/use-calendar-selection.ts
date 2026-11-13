'use client';

import { useState } from 'react';

import { useAssignDialog } from './use-assign-dialog';

import type { BookingDto } from '../dto/booking-dto';

/**
 * The booking chosen in the calendar: its details dialog, and the assignment dialog that replaces it
 * when "Mitarbeiter zuweisen" is chosen (the first open employee unit is the one filled).
 */
export function useCalendarSelection(items: readonly BookingDto[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const selected = items.find((booking) => booking.id === selectedId) ?? null;
  const openUnit = selected?.units.find(
    (unit) => unit.resourceType === 'employee' && unit.resourceId === null,
  );
  const assign = useAssignDialog({
    bookingId: selected?.id ?? '',
    requirementIndex: openUnit?.requirementIndex,
  });

  return {
    selected,
    isOpenForAssignment: selected?.status === 'confirmed' && openUnit !== undefined,
    isDetailsOpen,
    assign,
    select: (id: string) => {
      setSelectedId(id);
      setIsDetailsOpen(true);
    },
    closeDetails: () => {
      setIsDetailsOpen(false);
    },
    startAssigning: () => {
      setIsDetailsOpen(false);
      assign.open();
    },
  };
}
