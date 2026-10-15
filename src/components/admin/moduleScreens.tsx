import React, { lazy } from 'react';
import type { EventConfig } from '@/types';
import { ADMIN_MODULES } from '@/data/adminModules';

// Each screen is loaded when its page is first opened, so the rest of the app stays small.
const KeyStakeholdersPage = lazy(() => import('./KeyStakeholdersPage').then((m) => ({ default: m.KeyStakeholdersPage })));
const KeynotePage = lazy(() => import('./KeynotePage').then((m) => ({ default: m.KeynotePage })));
const BudgetPage = lazy(() => import('./budget/BudgetPage').then((m) => ({ default: m.BudgetPage })));
const ModuleWorkspacePage = lazy(() => import('./ModuleWorkspacePage').then((m) => ({ default: m.ModuleWorkspacePage })));
const OtherPage = lazy(() => import('./other/OtherPage').then((m) => ({ default: m.OtherPage })));
const OverviewPage = lazy(() => import('./overview/OverviewPage').then((m) => ({ default: m.OverviewPage })));
const ResourcesPage = lazy(() => import('./resources/ResourcesPage').then((m) => ({ default: m.ResourcesPage })));
const SchedulePage = lazy(() => import('./schedule/SchedulePage').then((m) => ({ default: m.SchedulePage })));

export interface ModuleScreenProps {
  event: EventConfig;
  /** Back to the event's menu. */
  onBack: () => void;
  /** Lets one module send the person to another, e.g. "add a stakeholder". */
  onOpenModule: (moduleId: string) => void;
}

/**
 * Every module that has a real screen. A module's page looks its id up here; an id that isn't listed
 * opens the shared workspace instead. Adding a module is one entry here plus its card in
 * data/adminModules.ts. (Expo Booths is the one exception: it is the expo floor, on its own route.)
 */
export const MODULE_SCREENS: Record<string, React.FC<ModuleScreenProps>> = {
  'key-stakeholders': ({ event, onBack }) => <KeyStakeholdersPage event={event} onBack={onBack} />,
  'keynote-general-session': ({ event, onBack, onOpenModule }) => (
    <KeynotePage event={event} onBack={onBack} onManageStakeholders={() => onOpenModule('key-stakeholders')} />
  ),
  budget: ({ event, onBack, onOpenModule }) => <BudgetPage event={event} onBack={onBack} onManageStakeholders={() => onOpenModule('key-stakeholders')} />,
  overview: ({ event, onBack, onOpenModule }) => <OverviewPage event={event} onBack={onBack} onOpenModule={onOpenModule} />,
  other: ({ event, onBack }) => <OtherPage event={event} onBack={onBack} />,
  resources: ({ event, onBack, onOpenModule }) => <ResourcesPage event={event} onBack={onBack} onManageStakeholders={() => onOpenModule('key-stakeholders')} />,
  schedule: ({ event, onBack, onOpenModule }) => <SchedulePage event={event} onBack={onBack} onManageStakeholders={() => onOpenModule('key-stakeholders')} />,
};

const workspaceScreens = new Map<string, React.FC<ModuleScreenProps>>();

/**
 * The screen for a module: its own if it has one, otherwise the shared workspace (links, a point of
 * contact and tasks). Null only for ids that are not modules, and for Expo Booths.
 */
export function resolveModuleScreen(moduleId: string): React.FC<ModuleScreenProps> | null {
  if (MODULE_SCREENS[moduleId]) return MODULE_SCREENS[moduleId];
  const module = ADMIN_MODULES.find((m) => m.id === moduleId);
  if (!module || moduleId === 'expo-booths') return null;
  // Cached so each module keeps one stable component. A new function on every call would make
  // React treat it as a different component and remount the screen whenever the parent re-renders.
  let screen = workspaceScreens.get(moduleId);
  if (!screen) {
    screen = ({ event, onBack, onOpenModule }) => <ModuleWorkspacePage module={module} event={event} onBack={onBack} onOpenModule={onOpenModule} />;
    workspaceScreens.set(moduleId, screen);
  }
  return screen;
}

export const hasModuleScreen = (moduleId: string): boolean => resolveModuleScreen(moduleId) !== null;
