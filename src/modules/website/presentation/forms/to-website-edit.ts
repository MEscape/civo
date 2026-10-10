import type { GeneralSettings } from '../schemas/general-settings-schema';
import type { WebsiteEdit } from '../schemas/website-edit-schema';

/** The update the action takes: an empty description clears the stored one (`null`), it does not store "". */
export function toWebsiteEdit(websiteId: string, values: GeneralSettings): WebsiteEdit {
  return {
    id: websiteId,
    name: values.name,
    description: values.description.trim() === '' ? null : values.description,
  };
}
