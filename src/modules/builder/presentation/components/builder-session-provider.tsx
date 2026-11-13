'use client';

import type { ReactNode } from 'react';

import { Provider } from 'react-redux';

import { NO_CATEGORY_OPTIONS } from '../dto/category-options-dto';
import { useSessionStore } from '../hooks/use-session-store';
import { BuilderSessionContext } from '../state/builder-session-context';

import type { BookingChoicesDto } from '../dto/booking-choices-dto';
import type { CategoryOptionsDto } from '../dto/category-options-dto';
import type { DatasetOptionsByKind } from '../dto/dataset-options-dto';
import type { EditorSessionDto } from '../dto/editor-session-dto';

export interface BuilderSessionProviderProps {
  readonly session: EditorSessionDto;
  readonly datasetOptions: DatasetOptionsByKind;
  /** Category values for `category` controls; omitted when no component asks for them. */
  readonly categoryOptions?: CategoryOptionsDto;
  /** The services and categories the booking component can be narrowed to (empty when unknown). */
  readonly bookingChoices: BookingChoicesDto;
  /** A component to select when the editor opens (`?select=`); ignored unless it is on the page. */
  readonly initialSelection?: string | undefined;
  readonly children: ReactNode;
}

/**
 * Owns one editing session: its store and catalog. Render it with
 * `key={session.page.id}` so another page starts a fresh session. Only the
 * builder route tree is wrapped; the public site never loads Redux.
 */
export function BuilderSessionProvider({
  session,
  datasetOptions,
  categoryOptions = NO_CATEGORY_OPTIONS,
  bookingChoices,
  initialSelection,
  children,
}: BuilderSessionProviderProps) {
  const { store, context } = useSessionStore({
    session,
    datasetOptions,
    categoryOptions,
    bookingChoices,
    initialSelection,
  });

  return (
    <Provider store={store}>
      <BuilderSessionContext.Provider value={context}>{children}</BuilderSessionContext.Provider>
    </Provider>
  );
}
