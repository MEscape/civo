import type { PageConfigJson } from '../../domain/models/page-config';

/**
 * A page as a publisher sees it: either usable, with its config as plain
 * JSON plus the component types it uses, or the reason it is not.
 */
export type ReleasePageView =
  | {
      readonly status: 'ready';
      readonly pageId: string;
      readonly version: number;
      readonly path: string;
      readonly title: string;
      readonly config: PageConfigJson;
      readonly componentTypes: readonly string[];
    }
  | {
      readonly status: 'config_missing' | 'config_invalid';
      readonly pageId: string;
      readonly version: number;
      readonly path: string;
      readonly title: string;
    };
