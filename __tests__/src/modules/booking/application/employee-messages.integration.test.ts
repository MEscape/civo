import { describe, expect, it } from 'vitest';

import type { Actor } from '@modules/auth';
import { toActorId } from '@modules/auth/domain/models/ids';
import { prismaActorMessageRepository as inbox } from '@modules/booking/infrastructure/prisma/prisma-actor-message.repository';

import { db } from '@lib/db';

import { createHarness } from '../support/application-harness';
import { NOW } from '../support/booking-fixtures';
import { useStaffSuite } from '../support/staff-suite';

/**
 * The employee's inbox (BD-11): a change to a booking someone serves writes them a message in the
 * same transaction, as a type and the booking's facts, never text; the one who made the change finds
 * it already read; only the recipient reads or marks it.
 */
const staff = useStaffSuite();
const { harness, suite, admin, anna, ben, at, created } = staff;
const DAY = '2027-01-15';

async function messagesOf(who: () => Actor, bookingId: string) {
  harness.actAs(who());
  const page = (
    await harness.queries.listMessages.execute({ websiteId: String(suite.world.scope.websiteId) })
  )._unsafeUnwrap();
  return page.items.filter((message) => 'bookingId' in message && message.bookingId === bookingId);
}

async function unreadOf(who: () => Actor) {
  harness.actAs(who());
  return (
    await harness.queries.countUnreadMessages.execute({
      websiteId: String(suite.world.scope.websiteId),
    })
  )._unsafeUnwrap();
}

describe('messages about the bookings an employee serves', () => {
  it('tells an employee a manager gave them a booking, with names read now and no text stored', async () => {
    const booking = await created('08:00', DAY, staff.openServiceId);
    const before = await unreadOf(ben);
    harness.actAs(admin());
    await harness.commands.assignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
      resourceId: suite.world.ids.ben,
    });

    const [message] = await messagesOf(ben, booking.id);
    expect(message).toMatchObject({
      type: 'assigned',
      isRead: false,
      serviceName: 'Beratung',
      locationName: 'Rathaus West',
      start: booking.start,
      timeZone: 'Europe/Berlin',
    });
    expect(await unreadOf(ben)).toBe(before + 1);
    expect(await messagesOf(anna, booking.id)).toHaveLength(0);

    const row = await db.orm.public.ActorMessage.where({ bookingId: booking.id })
      .select('params', 'recipientActorId')
      .first();
    expect(Object.keys(row?.params as object).sort()).toEqual([
      'end',
      'locationId',
      'serviceId',
      'start',
    ]);
    expect(row?.recipientActorId).toBe(suite.world.actors.ben);
  });

  it('keeps a claim and a hand-back of one’s own as read records', async () => {
    const booking = await created('08:30', DAY, staff.openServiceId);
    const before = await unreadOf(anna);
    harness.actAs(anna());
    await harness.commands.claimBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });
    await harness.commands.handBackBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
    });

    const messages = await messagesOf(anna, booking.id);
    expect(messages.map(({ type }) => type).sort()).toEqual(['assigned', 'unassigned']);
    expect(messages.every(({ isRead }) => isRead)).toBe(true);
    expect(await unreadOf(anna)).toBe(before);
  });

  it('tells the employee when a manager takes them off, moves or cancels the booking', async () => {
    const offBooking = await created('09:00', DAY, staff.openServiceId);
    harness.actAs(admin());
    await harness.commands.assignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: offBooking.id,
      resourceId: suite.world.ids.ben,
    });
    await harness.commands.unassignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: offBooking.id,
      resourceId: suite.world.ids.ben,
    });
    expect((await messagesOf(ben, offBooking.id)).map(({ type }) => type).sort()).toEqual([
      'assigned',
      'unassigned',
    ]);

    harness.actAs(admin());
    const moved = await created('10:00', DAY);
    const server = moved.units[0]?.resourceId === suite.world.ids.anna ? anna : ben;
    harness.actAs(admin());
    const after = (
      await harness.commands.rescheduleBooking.execute({
        websiteId: String(suite.world.scope.websiteId),
        bookingId: moved.id,
        start: at('11:00', DAY),
      })
    )._unsafeUnwrap();
    const stayed = after.units[0]?.resourceId === moved.units[0]?.resourceId;
    // Told when it was made (the service assigned them), and again when it moved or was taken from them.
    expect((await messagesOf(server, moved.id)).map(({ type }) => type).sort()).toEqual(
      ['assigned', stayed ? 'rescheduled' : 'unassigned'].sort(),
    );

    harness.actAs(admin());
    await harness.commands.cancelBooking.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: moved.id,
    });
    const current = after.units[0]?.resourceId === suite.world.ids.anna ? anna : ben;
    expect((await messagesOf(current, moved.id)).map(({ type }) => type)).toContain('cancelled');
  });

  it('tells the employee a service assigned them when the booking is made, and nobody when it waits for one', async () => {
    const assigned = await created('15:00', DAY);
    const server = assigned.units[0]?.resourceId === suite.world.ids.anna ? anna : ben;
    const other = server === anna ? ben : anna;
    const waiting = await created('15:30', DAY, staff.openServiceId);

    const [message] = await messagesOf(server, assigned.id);
    expect(message).toMatchObject({ type: 'assigned', isRead: false });
    expect(await messagesOf(other, assigned.id)).toHaveLength(0);
    // An open booking has nobody on it yet: it is offered, not told.
    expect(await messagesOf(anna, waiting.id)).toHaveLength(0);
    expect(await messagesOf(ben, waiting.id)).toHaveLength(0);
  });

  it('tells only the winner of two simultaneous claims', async () => {
    const booking = await created('13:00', DAY, staff.openServiceId);
    const sessions = [createHarness(), createHarness()];
    sessions[0]?.actAs(anna());
    sessions[1]?.actAs(ben());
    await Promise.all(
      sessions.map((session) =>
        session.commands.claimBooking.execute({
          websiteId: String(suite.world.scope.websiteId),
          bookingId: booking.id,
        }),
      ),
    );

    const told = [...(await messagesOf(anna, booking.id)), ...(await messagesOf(ben, booking.id))];
    expect(told).toHaveLength(1);
    expect(told[0]?.type).toBe('assigned');
  });

  it('marks one or all read, only the recipient’s own, and a repeat changes nothing', async () => {
    const booking = await created('14:00', DAY, staff.openServiceId);
    harness.actAs(admin());
    await harness.commands.assignEmployee.execute({
      websiteId: String(suite.world.scope.websiteId),
      bookingId: booking.id,
      resourceId: suite.world.ids.ben,
    });
    const [message] = await messagesOf(ben, booking.id);
    const id = message?.id ?? '';

    harness.actAs(anna());
    const foreign = (
      await harness.commands.markMessagesRead.execute({
        websiteId: String(suite.world.scope.websiteId),
        messageId: id,
      })
    )._unsafeUnwrap();
    expect(foreign.marked).toBe(0);
    expect((await messagesOf(ben, booking.id))[0]?.isRead).toBe(false);

    harness.actAs(ben());
    const own = (
      await harness.commands.markMessagesRead.execute({
        websiteId: String(suite.world.scope.websiteId),
        messageId: id,
      })
    )._unsafeUnwrap();
    expect(own.marked).toBe(1);
    expect(harness.enforced).toContain('booking.employee-actor');
    const all = (
      await harness.commands.markMessagesRead.execute({
        websiteId: String(suite.world.scope.websiteId),
        messageId: null,
      })
    )._unsafeUnwrap();
    const again = (
      await harness.commands.markMessagesRead.execute({
        websiteId: String(suite.world.scope.websiteId),
        messageId: null,
      })
    )._unsafeUnwrap();
    expect(all.marked).toBeGreaterThanOrEqual(0);
    expect(again.marked).toBe(0);
    expect(await unreadOf(ben)).toBe(0);
  });

  it('refuses an empty message id and anyone without the employee permission', async () => {
    harness.actAs(ben());
    const invalid = (
      await harness.commands.markMessagesRead.execute({
        websiteId: String(suite.world.scope.websiteId),
        messageId: '',
      })
    )._unsafeUnwrapErr();
    expect(invalid.code).toBe('booking.validation_failed');

    harness.actAs(null);
    const refused = (
      await harness.queries.listMessages.execute({ websiteId: String(suite.world.scope.websiteId) })
    )._unsafeUnwrapErr();
    expect(refused.code).toBe('auth.permission_denied');
  });

  it('finds nothing of one website’s inbox from another website', async () => {
    const actor = toActorId(suite.world.actors.ben);
    const page = (
      await inbox.list(suite.world.otherScope, actor, { limit: 10, offset: 0 })
    )._unsafeUnwrap();
    expect(page.items).toHaveLength(0);
    const marked = (
      await inbox.markRead(suite.world.otherScope, actor, { messageId: null, now: NOW })
    )._unsafeUnwrap();
    expect(marked).toBe(0);
  });
});
