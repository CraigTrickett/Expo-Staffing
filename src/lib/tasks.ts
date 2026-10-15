import type { Task, TasksData } from '@/types/tasks';
import type { StakeholderRef } from '@/types/stakeholderRef';

export const TASKS_MODULE_ID = 'tasks';
/** Tasks that belong to no particular module. */
export const OTHER_MODULE_ID = 'other';

export function createEmptyTasks(): TasksData {
  return { tasks: [] };
}

export function normaliseTasks(raw: Partial<TasksData> | null | undefined): TasksData {
  return { tasks: Array.isArray(raw?.tasks) ? raw!.tasks! : [] };
}

export interface TaskInput {
  title: string;
  notes?: string;
  moduleId?: string;
  owner?: StakeholderRef | null;
  raisedBy?: string;
  dueDate?: string;
}

export function createTask(input: TaskInput, now: Date = new Date()): Task {
  return {
    id: `task_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    moduleId: input.moduleId || undefined,
    owner: input.owner ?? undefined,
    raisedBy: input.raisedBy?.trim() || undefined,
    dueDate: input.dueDate || undefined,
    status: 'open',
    createdAt: now.toISOString(),
  };
}

export const todayIso = (now: Date = new Date()): string =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

/** Overdue means still open and due before today. Due today is not overdue. */
export function isOverdue(task: Task, today: string = todayIso()): boolean {
  return task.status === 'open' && !!task.dueDate && task.dueDate < today;
}

export function toggleTask(task: Task, now: Date = new Date()): Task {
  return task.status === 'open'
    ? { ...task, status: 'done', completedAt: now.toISOString() }
    : { ...task, status: 'open', completedAt: undefined };
}

export function tasksForModule(tasks: Task[], moduleId: string): Task[] {
  return tasks.filter((t) => t.moduleId === moduleId);
}

/** Open first (overdue, then soonest due, then undated, then newest), done last. */
export function sortTasks(tasks: Task[], today: string = todayIso()): Task[] {
  const rank = (t: Task) => (t.status === 'done' ? 3 : isOverdue(t, today) ? 0 : t.dueDate ? 1 : 2);
  return [...tasks].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
  });
}

export interface TaskStats {
  open: number;
  overdue: number;
  done: number;
}

export function taskStats(tasks: Task[], today: string = todayIso()): TaskStats {
  return {
    open: tasks.filter((t) => t.status === 'open').length,
    overdue: tasks.filter((t) => isOverdue(t, today)).length,
    done: tasks.filter((t) => t.status === 'done').length,
  };
}
