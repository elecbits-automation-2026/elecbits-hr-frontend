import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Goal, GoalCategory } from '@app-types/api.types';
import { GOAL_CATEGORY_LABELS } from '@constants/Common/quarter.constants';
import { performanceApi } from '@services/api/performance.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none';

/** One goal: read view, or an inline edit form. Delete needs a second click. */
const GoalRow = ({ goal, onChanged }: { goal: Goal; onChanged: () => void }) => {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [metric, setMetric] = useState(goal.metric ?? '');
  const [target, setTarget] = useState(goal.target ?? '');
  const [weight, setWeight] = useState(String(goal.weight));
  const [category, setCategory] = useState<GoalCategory>(goal.category);
  const [dueOn, setDueOn] = useState(goal.dueOn);

  const save = useMutation({
    mutationFn: () =>
      performanceApi.updateGoal(goal.id, {
        title: title.trim(),
        metric: metric.trim() || null,
        target: target.trim() || null,
        weight: Number(weight),
        category,
        dueOn,
      }),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: () => performanceApi.deleteGoal(goal.id),
    onSuccess: onChanged,
  });

  if (!editing) {
    return (
      <li className='rounded-lg border border-slate-100 bg-slate-50 p-3'>
        <div className='flex flex-wrap items-baseline justify-between gap-2'>
          <span className='font-medium text-slate-800'>{goal.title}</span>
          <span className='text-sm tabular-nums text-slate-600'>{goal.progress}%</span>
        </div>
        <p className='mt-0.5 text-xs text-slate-400'>
          {goal.metric && (
            <>
              {goal.metric}
              {goal.target ? ` → ${goal.target}` : ''} ·{' '}
            </>
          )}
          {GOAL_CATEGORY_LABELS[goal.category].label} · weight {goal.weight} · due {goal.dueOn}
        </p>
        <div className='mt-2 flex gap-3'>
          <button
            type='button'
            onClick={() => setEditing(true)}
            className='text-xs text-brand-600 hover:underline'
          >
            Edit
          </button>
          <button
            type='button'
            disabled={remove.isPending}
            onClick={() => (confirmDelete ? remove.mutate() : setConfirmDelete(true))}
            className={`text-xs hover:underline ${confirmDelete ? 'font-medium text-red-600' : 'text-slate-400'}`}
          >
            {confirmDelete ? 'Click again to delete' : 'Delete'}
          </button>
        </div>
        {remove.error && (
          <p className='mt-1 text-xs text-red-600'>{apiErrorMessage(remove.error)}</p>
        )}
      </li>
    );
  }

  return (
    <li className='space-y-2 rounded-lg border border-brand-100 bg-white p-3'>
      <input
        aria-label='Goal title'
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={inputClass}
      />
      <div className='grid grid-cols-2 gap-2'>
        <input
          aria-label='Metric'
          placeholder='Metric (optional)'
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label='Target'
          placeholder='Target (optional)'
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className={inputClass}
        />
      </div>
      <label className='block text-xs text-slate-500'>
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as GoalCategory)}
          className={`${inputClass} mt-1`}
        >
          {(Object.keys(GOAL_CATEGORY_LABELS) as GoalCategory[]).map((c) => (
            <option key={c} value={c}>
              {GOAL_CATEGORY_LABELS[c].label} — {GOAL_CATEGORY_LABELS[c].share}%
            </option>
          ))}
        </select>
      </label>
      <div className='grid grid-cols-2 gap-2'>
        <label className='text-xs text-slate-500'>
          Weight
          <input
            type='number'
            min={0.5}
            max={100}
            step={0.5}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className='text-xs text-slate-500'>
          Due on
          <input
            type='date'
            value={dueOn}
            onChange={(e) => setDueOn(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      {save.error && <p className='text-xs text-red-600'>{apiErrorMessage(save.error)}</p>}
      <div className='flex justify-end gap-2'>
        <button
          type='button'
          onClick={() => setEditing(false)}
          className='rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50'
        >
          Cancel
        </button>
        <button
          type='button'
          disabled={save.isPending || title.trim().length < 3}
          onClick={() => save.mutate()}
          className='rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-500 disabled:opacity-40'
        >
          Save
        </button>
      </div>
    </li>
  );
};

/**
 * A report's goals for this quarter, editable and deletable by their RM or
 * HR while the quarter is open (the server enforces who and when). Progress
 * stays the owner's — it is shown, never edited here.
 */
const ManageGoalsModal = ({
  person,
  onClose,
}: {
  person: { id: string; name: string };
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const goals = useQuery({
    queryKey: ['team-member-goals', person.id],
    queryFn: () => performanceApi.teamMemberGoals(person.id),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['team-member-goals', person.id] });
    queryClient.invalidateQueries({ queryKey: ['team-goals'] });
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'>
      <div className='max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <h2 className='text-lg font-semibold text-slate-800'>{person.name}&rsquo;s goals</h2>
            {goals.data && (
              <p className='text-xs text-slate-400'>
                {goals.data.cycle.name} · weights total {goals.data.weightTotal}
                {goals.data.weightTotal !== 100 ? ' (should be 100)' : ''}
              </p>
            )}
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50'
          >
            Close
          </button>
        </div>
        {goals.isLoading && <p className='mt-4 text-sm text-slate-400'>Loading…</p>}
        {goals.error && <p className='mt-4 text-sm text-red-600'>{apiErrorMessage(goals.error)}</p>}
        {goals.data && goals.data.goals.length === 0 && (
          <p className='mt-4 text-sm text-slate-500'>No goals this quarter yet.</p>
        )}
        <ul className='mt-4 space-y-2'>
          {(goals.data?.goals ?? []).map((g) => (
            <GoalRow
              key={`${g.id}:${g.title}:${g.weight}:${g.dueOn}:${g.category}`}
              goal={g}
              onChanged={refresh}
            />
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ManageGoalsModal;
