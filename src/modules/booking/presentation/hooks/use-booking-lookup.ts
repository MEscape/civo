'use client';

import { useState, useTransition } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { applyActionError } from '@lib/actions';

import { findBookingAction } from '../actions/find-booking-action';
import { emailSchema, referenceSchema } from '../schemas/booking-fields-schema';

import type { PublicBookingDto } from '../dto/booking-dto';

const lookupSchema = z.object({ reference: referenceSchema, email: emailSchema });
type LookupValues = z.infer<typeof lookupSchema>;

/** A booking the visitor reached, and the address that proved it theirs (every change needs it again). */
export interface FoundBooking {
  readonly booking: PublicBookingDto;
  readonly email: string;
}

/**
 * "Show my booking": the reference (filled in when the visitor came by the link of a message) and
 * the address it was made with. A wrong address and an unknown reference get the same answer.
 */
export function useBookingLookup(
  websiteId: string,
  initialReference: string | undefined,
  onFound: (found: FoundBooking) => void,
) {
  const [isPending, startTransition] = useTransition();
  const [formCode, setFormCode] = useState<string | null>(null);
  const form = useForm<LookupValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { reference: initialReference ?? '', email: '' },
  });

  const find = form.handleSubmit((values) => {
    setFormCode(null);
    startTransition(async () => {
      const result = await findBookingAction({ websiteId, ...values });
      if (result.ok) {
        onFound({ booking: result.data, email: values.email });
        return;
      }
      setFormCode(applyActionError(result.error, form.setError));
    });
  });

  return { form, find, isPending, formCode };
}
