import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

import type { ContentListView } from '../../../../application/contracts/content-views';

export interface NewsColumnProps {
  readonly heading: string;
  /** What replaces the list while its source is unavailable. */
  readonly unavailableText: string;
  /** `null`: the source failed. */
  readonly list: ContentListView<'NewsItem'> | null;
}

/** The news half of the split. A failing source degrades this column only. */
export function NewsColumn({ heading, unavailableText, list }: NewsColumnProps) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium uppercase tracking-wide text-copy-muted">{heading}</h3>
      {list === null ? (
        <p className="text-sm text-copy-muted">{unavailableText}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.items.map((item) => (
            <li key={item.id}>
              <Card>
                <CardHeader>
                  {item.category !== undefined && (
                    <p className="text-xs font-medium text-accent-copy">{item.category}</p>
                  )}
                  <CardTitle>{item.title}</CardTitle>
                  {item.excerpt !== undefined && <CardDescription>{item.excerpt}</CardDescription>}
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
