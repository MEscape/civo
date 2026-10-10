import { unique } from '@lib/utils';

import type { CategoryOptionsDto } from '../dto/category-options-dto';

export interface CategoryChoiceRequest {
  readonly kind: string;
  /** The datasets the node is bound to; empty while it shows sample data. */
  readonly datasetIds: readonly string[];
}

const NONE: readonly string[] = [];

function lookup(
  table: Readonly<Record<string, readonly string[]>>,
  key: string,
): readonly string[] {
  return Object.hasOwn(table, key) ? (table[key] ?? NONE) : NONE;
}

/**
 * The values a `category` control can offer: those of the bound datasets
 * (several datasets are merged), or of the sample data while the node is
 * unbound, which is also what the canvas renders then.
 */
export function categoryChoices(
  options: CategoryOptionsDto,
  request: CategoryChoiceRequest,
): readonly string[] {
  if (request.datasetIds.length === 0) {
    return lookup(options.sampleByKind, request.kind);
  }
  return unique(request.datasetIds.flatMap((id) => lookup(options.byDataset, id))).sort(
    (first, second) => first.localeCompare(second),
  );
}
