export type AdminModuleCategory = 'Operations' | 'Programming' | 'Commercial' | 'Logistics' | 'General';

export interface AdminModuleItem {
  id: string;
  title: string;
  /** One short line saying what the module is for. */
  subtitle: string;
  iconName: string;
  /** 'coming_soon' means it has no tools of its own yet. */
  status: 'active' | 'coming_soon';
  category: AdminModuleCategory;
}
