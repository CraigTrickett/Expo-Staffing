import type { AdminModuleItem } from '@/types/adminHub';

/**
 * The cards on the event menu. A module with `status: 'coming_soon'` has no tools of its own yet:
 * it opens a page for links, a point of contact and tasks, and its card says so.
 */
export const ADMIN_MODULES: AdminModuleItem[] = [
  { id: 'overview', title: 'Overview', subtitle: 'Where every area stands', iconName: 'LayoutDashboard', status: 'active', category: 'General' },
  { id: 'expo-booths', title: 'Expo Booths', subtitle: 'Booth shift schedule & coverage', iconName: 'Store', status: 'active', category: 'Operations' },
  { id: 'key-stakeholders', title: 'Key Stakeholders', subtitle: 'VIP directory & liaison contacts', iconName: 'Users', status: 'active', category: 'Operations' },
  { id: 'deadlines', title: 'Deadlines', subtitle: 'Milestones, cutoffs & countdowns', iconName: 'Clock', status: 'coming_soon', category: 'Operations' },
  { id: 'sponsorship', title: 'Sponsorship', subtitle: 'Sponsor packages & deliverables', iconName: 'BadgeDollarSign', status: 'coming_soon', category: 'Commercial' },
  { id: 'swag', title: 'Swag', subtitle: 'Promotional merchandise & inventory', iconName: 'Gift', status: 'coming_soon', category: 'Operations' },
  { id: 'keynote-general-session', title: 'Keynote / General Session', subtitle: 'Mainstage run-of-show & speakers', iconName: 'Mic', status: 'active', category: 'Programming' },
  { id: 'schedule', title: 'Schedule', subtitle: 'Rooms, sessions & the agenda grid', iconName: 'CalendarRange', status: 'active', category: 'Programming' },
  { id: 'resources', title: 'Resources', subtitle: 'Links to the documents the team needs', iconName: 'FolderOpen', status: 'active', category: 'Logistics' },
  { id: 'social-event', title: 'Social Event', subtitle: 'Receptions, dinners & networking', iconName: 'PartyPopper', status: 'coming_soon', category: 'Programming' },
  { id: 'budget', title: 'Budget', subtitle: 'Approved budget, forecast & actual cost', iconName: 'Calculator', status: 'active', category: 'Commercial' },
  { id: 'marketing', title: 'Marketing', subtitle: 'Campaigns, PR & signage', iconName: 'Megaphone', status: 'coming_soon', category: 'Commercial' },
  { id: 'badging-registration', title: 'Badging & Registration', subtitle: 'Signup questionnaire, contact & tasks', iconName: 'IdCard', status: 'active', category: 'Operations' },
  { id: 'catering-hospitality', title: 'Catering & Hospitality', subtitle: 'Food, beverage & dietary needs', iconName: 'Utensils', status: 'coming_soon', category: 'Logistics' },
  { id: 'other', title: 'Other', subtitle: 'Tasks, notes & links', iconName: 'Inbox', status: 'active', category: 'General' },
];
