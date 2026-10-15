import type { StakeholderRef } from './stakeholderRef';

export type TaskStatus = 'open' | 'done';

/**
 * One shared task list per event. A task is tagged with the module it belongs to
 * (a hub module id, or 'other'), so each module can show its own and Other and
 * Overview can show them all.
 */
export interface Task {
  id: string;
  title: string;
  notes?: string;
  moduleId?: string;
  owner?: StakeholderRef;
  /** Free text: who raised it and when, e.g. "Jaana Hannila, 5 Aug". */
  raisedBy?: string;
  /** YYYY-MM-DD */
  dueDate?: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
}

export interface TasksData {
  tasks: Task[];
}
