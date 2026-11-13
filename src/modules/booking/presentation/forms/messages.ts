import type { MessageDto } from '../dto/employee-dto';

export interface MessageDay {
  /** `YYYY-MM-DD` on the clock the messages were stamped on. */
  readonly day: string;
  readonly when: 'today' | 'yesterday' | 'earlier';
  readonly items: readonly MessageDto[];
}

function whenOf(
  day: string,
  days: { readonly today: string; readonly yesterday: string },
): MessageDay['when'] {
  if (day === days.today) {
    return 'today';
  }
  return day === days.yesterday ? 'yesterday' : 'earlier';
}

/** The messages of a page by the day they arrived, newest day first, keeping their order inside a day. */
export function groupByDay(
  items: readonly MessageDto[],
  days: { readonly today: string; readonly yesterday: string },
): MessageDay[] {
  const groups: Array<{ day: string; items: MessageDto[] }> = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.day === item.day) {
      last.items.push(item);
    } else {
      groups.push({ day: item.day, items: [item] });
    }
  }
  return groups.map(({ day, items: dayItems }) => ({
    day,
    when: whenOf(day, days),
    items: dayItems,
  }));
}
