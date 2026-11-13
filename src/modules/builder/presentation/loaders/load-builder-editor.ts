import { orNotFound } from '@lib/errors/or-not-found';
import type { AppResultAsync } from '@lib/result';
import { assertNever } from '@lib/utils';

import { NO_BOOKING_CHOICES } from '../dto/booking-choices-dto';
import { toDatasetOptionsByType } from '../dto/dataset-options-dto';
import { toEditorSessionDto } from '../dto/editor-session-dto';
import { collectCategoryTypes, collectDatasetTypes } from '../properties/dataset-types';
import { editorParamsSchema } from '../schemas/editor-params-schema';

import type { EditorSessionView } from '../../application/contracts/page-views';
import type { BookingChoicesDto } from '../dto/booking-choices-dto';
import type { CategoryOptionsDto } from '../dto/category-options-dto';

/** One dataset as the data module answers; the builder keeps only what its controls show. */
interface CompatibleDataset {
  readonly id: string;
  readonly name: string;
  readonly canonicalKind: string;
  readonly source: { readonly name: string };
}

/**
 * What the editor is opened with beyond the page: choices that belong to other modules. The
 * route hands them over (it may use every module's public API), the builder only displays them,
 * so it never imports those modules.
 */
export interface BuilderEditorChoiceReaders {
  readonly listCompatibleDatasets: {
    execute(input: {
      readonly websiteId: string;
      readonly canonicalKinds: readonly string[];
    }): AppResultAsync<{
      readonly items: readonly CompatibleDataset[];
      readonly isTruncated: boolean;
    }>;
  };
  /** Infallible: an unreadable dataset just offers no categories. */
  readonly listContentCategories: {
    execute(input: {
      readonly websiteId: string;
      readonly kinds: readonly string[];
      readonly datasets: ReadonlyArray<{ readonly id: string; readonly kind: string }>;
    }): AppResultAsync<CategoryOptionsDto, never>;
  };
  readonly getBookingChoices: { execute(): AppResultAsync<BookingChoicesDto> };
}

export interface BuilderEditorReaders extends BuilderEditorChoiceReaders {
  readonly getEditorSession: {
    execute(websiteId: string, pageId: string): AppResultAsync<EditorSessionView>;
  };
}

interface LoadBuilderEditorInput {
  readonly websiteId: string;
  readonly pageId: string;
  /** The raw query of the request; parsed here, never trusted. */
  readonly searchParams: Readonly<Record<string, string | string[] | undefined>>;
  readonly readers: BuilderEditorReaders;
}

/**
 * Reads everything the editor opens with: the page session, the datasets and categories its
 * components can bind to, and the booking choices. A person who may not edit this page gets
 * "not found". The booking choices are always offered because the palette can add a booking
 * component at any time; a refusal or a failure only means the dropdowns offer "all".
 */
export async function loadBuilderEditor({
  websiteId,
  pageId,
  searchParams,
  readers,
}: LoadBuilderEditorInput) {
  const sessionView = await orNotFound(readers.getEditorSession.execute(websiteId, pageId));

  const datasetChoices = await orNotFound(
    readers.listCompatibleDatasets.execute({
      websiteId,
      canonicalKinds: collectDatasetTypes(sessionView.components),
    }),
  );
  const datasets = datasetChoices.items;
  const categoryKinds = collectCategoryTypes(sessionView.components);
  const [categoryOptions, bookingChoices] = await Promise.all([
    readers.listContentCategories
      .execute({
        websiteId,
        kinds: categoryKinds,
        datasets: datasets
          .filter((dataset) => categoryKinds.includes(dataset.canonicalKind))
          .map((dataset) => ({ id: dataset.id, kind: dataset.canonicalKind })),
      })
      .match((view) => view, assertNever),
    readers.getBookingChoices.execute().match(
      (view) => view,
      () => NO_BOOKING_CHOICES,
    ),
  ]);

  return {
    page: { title: sessionView.page.title, path: sessionView.page.path },
    session: toEditorSessionDto(sessionView),
    isDatasetListTruncated: datasetChoices.isTruncated,
    datasetOptions: toDatasetOptionsByType(
      datasets.map((dataset) => ({
        id: dataset.id,
        name: dataset.name,
        canonicalKind: dataset.canonicalKind,
        sourceName: dataset.source.name,
      })),
    ),
    categoryOptions,
    bookingChoices,
    initialSelection: editorParamsSchema.parse(searchParams).select,
  };
}
