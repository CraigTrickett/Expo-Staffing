import type { StakeholderRef } from './stakeholderRef';

/** A link to something the team needs, with the key stakeholder who looks after it. */
export interface ResourceItem {
  id: string;
  title: string;
  /** A web link to the file or page. Files are never uploaded here. */
  url: string;
  /** The id of the hub module this resource belongs to, so its category is that module's name. */
  categoryId: string;
  /** The key stakeholder to ask about it. */
  owner: StakeholderRef;
  notes?: string;
  createdAt: string;
}

export interface ResourcesData {
  resources: ResourceItem[];
}
