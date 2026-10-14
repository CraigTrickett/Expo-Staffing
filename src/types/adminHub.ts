export type AdminModuleCategory = 'Operations' | 'Programming' | 'Commercial' | 'Logistics';

export interface AdminModuleItem {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  iconName: string;
  status: 'active' | 'coming_soon';
  category: AdminModuleCategory;
  badgeText?: string;
  featureOverview: {
    headline: string;
    summary: string;
    keyCapabilities: string[];
    upcomingMilestones: string[];
  };
}

export type AdminModuleSortMode = 'alphabetical' | 'mru';
