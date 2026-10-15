import type { StakeholderRef } from './stakeholderRef';

export interface ModuleLink {
  id: string;
  label: string;
  url: string;
}

/** What every module can carry without a bespoke screen: links, a person to ask, and tasks (kept separately). */
export interface ModuleEssentials {
  links: ModuleLink[];
  contact?: StakeholderRef;
}

export interface EssentialsData {
  modules: Record<string, ModuleEssentials>;
}
