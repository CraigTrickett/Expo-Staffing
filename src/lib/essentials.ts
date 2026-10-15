import type { EssentialsData, ModuleEssentials, ModuleLink } from '@/types/essentials';
import type { StakeholderRef } from '@/types/stakeholderRef';
import { isLinkFailure, parseLink } from './links';

export const ESSENTIALS_MODULE_ID = 'essentials';

export const createEmptyEssentials = (): EssentialsData => ({ modules: {} });

export function normaliseEssentials(raw: Partial<EssentialsData> | null | undefined): EssentialsData {
  return { modules: raw && typeof raw.modules === 'object' && raw.modules ? raw.modules : {} };
}

const EMPTY: ModuleEssentials = { links: [] };

export function getEssentials(data: EssentialsData, moduleId: string): ModuleEssentials {
  const found = data.modules[moduleId];
  return found ? { links: found.links ?? [], contact: found.contact } : EMPTY;
}

function put(data: EssentialsData, moduleId: string, next: ModuleEssentials): EssentialsData {
  return { ...data, modules: { ...data.modules, [moduleId]: next } };
}

export type EssentialsResult = { ok: true; data: EssentialsData } | { ok: false; error: string };

export function addLink(data: EssentialsData, moduleId: string, label: string, rawUrl: string): EssentialsResult {
  const parsed = parseLink(rawUrl);
  if (isLinkFailure(parsed)) return parsed;
  const current = getEssentials(data, moduleId);
  if (current.links.some((l) => l.url === parsed.url)) return { ok: false, error: 'That link is already listed.' };
  const link: ModuleLink = {
    id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    label: label.trim() || 'Link',
    url: parsed.url,
  };
  return { ok: true, data: put(data, moduleId, { ...current, links: [...current.links, link] }) };
}

export function updateLink(data: EssentialsData, moduleId: string, linkId: string, label: string, rawUrl: string): EssentialsResult {
  const parsed = parseLink(rawUrl);
  if (isLinkFailure(parsed)) return parsed;
  const current = getEssentials(data, moduleId);
  const links = current.links.map((l) => (l.id === linkId ? { ...l, label: label.trim() || l.label, url: parsed.url } : l));
  return { ok: true, data: put(data, moduleId, { ...current, links }) };
}

export function removeLink(data: EssentialsData, moduleId: string, linkId: string): EssentialsData {
  const current = getEssentials(data, moduleId);
  return put(data, moduleId, { ...current, links: current.links.filter((l) => l.id !== linkId) });
}

export function setContact(data: EssentialsData, moduleId: string, contact: StakeholderRef | null): EssentialsData {
  return put(data, moduleId, { ...getEssentials(data, moduleId), contact: contact ?? undefined });
}

/** Wording that fits a module. Anything not listed gets the plain defaults. */
export interface EssentialsPreset {
  linkLabel: string;
  contactLabel: string;
}

export const DEFAULT_PRESET: EssentialsPreset = {
  linkLabel: 'Link',
  contactLabel: 'Point of contact',
};

export const ESSENTIALS_PRESETS: Record<string, Partial<EssentialsPreset>> = {
  'badging-registration': {
    linkLabel: 'Signup questionnaire',
  },
};

export const presetFor = (moduleId: string): EssentialsPreset => ({ ...DEFAULT_PRESET, ...ESSENTIALS_PRESETS[moduleId] });
