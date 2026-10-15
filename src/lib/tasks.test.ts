import { describe, it, expect } from 'vitest';
import { createTask, isOverdue, normaliseTasks, sortTasks, taskStats, tasksForModule, toggleTask } from './tasks';

const NOW = new Date('2026-10-14T12:00:00');
const mk = (title: string, extra = {}) => createTask({ title, ...extra }, new Date(NOW.getTime() + title.length));

describe('tasks', () => {
  it('creates an open task, trimming and dropping empty optional fields', () => {
    const t = createTask({ title: '  Book shuttle ', notes: '  ', raisedBy: '', moduleId: 'badging-registration' }, NOW);
    expect(t).toMatchObject({ title: 'Book shuttle', status: 'open', moduleId: 'badging-registration' });
    expect(t.notes).toBeUndefined();
    expect(t.raisedBy).toBeUndefined();
  });

  it('overdue means open and due before today; due today is not overdue', () => {
    expect(isOverdue(mk('a', { dueDate: '2026-10-13' }), '2026-10-14')).toBe(true);
    expect(isOverdue(mk('a', { dueDate: '2026-10-14' }), '2026-10-14')).toBe(false);
    expect(isOverdue(mk('a'), '2026-10-14')).toBe(false);
    expect(isOverdue(toggleTask(mk('a', { dueDate: '2026-10-01' })), '2026-10-14')).toBe(false);
  });

  it('toggles done and back, stamping and clearing the completion time', () => {
    const done = toggleTask(mk('a'), NOW);
    expect(done).toMatchObject({ status: 'done', completedAt: NOW.toISOString() });
    expect(toggleTask(done).completedAt).toBeUndefined();
  });

  it('sorts overdue first, then by due date, then undated, then done', () => {
    const list = [
      toggleTask(mk('done one', { dueDate: '2026-10-01' })),
      mk('undated'),
      mk('due late', { dueDate: '2026-12-01' }),
      mk('overdue', { dueDate: '2026-10-01' }),
      mk('due soon', { dueDate: '2026-10-20' }),
    ];
    expect(sortTasks(list, '2026-10-14').map((t) => t.title)).toEqual(['overdue', 'due soon', 'due late', 'undated', 'done one']);
  });

  it('counts and filters by module', () => {
    const list = [mk('a', { moduleId: 'x', dueDate: '2026-10-01' }), toggleTask(mk('b', { moduleId: 'x' })), mk('c', { moduleId: 'y' })];
    expect(tasksForModule(list, 'x')).toHaveLength(2);
    expect(taskStats(list, '2026-10-14')).toEqual({ open: 2, overdue: 1, done: 1 });
  });

  it('copes with missing or partial stored data', () => {
    expect(normaliseTasks(null)).toEqual({ tasks: [] });
    expect(normaliseTasks({} as never)).toEqual({ tasks: [] });
  });
});
