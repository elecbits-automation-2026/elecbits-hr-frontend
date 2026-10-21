import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EmployeeWithClaim, Level } from '@app-types/api.types';
import { accessApi } from '@services/api/access.api';
import { attendanceApi } from '@services/api/attendance.api';
import { departmentsApi } from '@services/api/departments.api';
import { employeesApi } from '@services/api/employees.api';
import { apiErrorMessage } from '@utils/apiError';

const LEVELS: Level[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';

/**
 * The claim instructions the admin sends until the mailer exists. The link
 * carries the SINGLE-USE invite token — without it the record cannot be
 * claimed, and this is the only moment the token is ever shown.
 */
const inviteText = (employee: EmployeeWithClaim) => {
  const link = employee.claim
    ? `${window.location.origin}/auth?claim=${employee.claim.token}`
    : `${window.location.origin}/auth`;
  const expiry = employee.claim
    ? ` The link expires on ${new Date(employee.claim.expiresAt).toLocaleDateString()}.`
    : '';
  return (
    `Hi ${employee.name}, your Elecbits HR record is ready.\n` +
    `Open ${link} and sign in with ${employee.email} to set your password.${expiry} ` +
    `You can complete your profile details after signing in.`
  );
};

/**
 * The Admin invite door (access-first, decisions D1–D4): admin chooses who
 * (email), where they sit (manager + level) and what they may do (batches).
 * The employee code is auto-generated; the person fills in their own details
 * in Profile after claiming. Email delivery is a later transport — for now
 * the admin copies the claim instructions.
 */
const InviteEmployeePage = () => {
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('L1');
  const [reportsTo, setReportsTo] = useState('');
  const [baseZoneId, setBaseZoneId] = useState('');
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [dateOfJoining, setDateOfJoining] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [designation, setDesignation] = useState('');
  const [invited, setInvited] = useState<EmployeeWithClaim | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: employees } = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list });
  const { data: batches } = useQuery({ queryKey: ['batches'], queryFn: accessApi.listBatches });
  const { data: zones } = useQuery({ queryKey: ['punch-zones'], queryFn: attendanceApi.listZones });
  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });

  const managers = (employees ?? []).filter((e) => e.status !== 'inactive');
  // The Employee batch attaches automatically — offering it would only confuse.
  const grantableBatches = (batches ?? []).filter((b) => b.name !== 'Employee');

  const invite = useMutation({
    mutationFn: employeesApi.invite,
    onSuccess: (employee) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      setInvited(employee);
    },
  });

  const toggleBatch = (id: string) =>
    setBatchIds((prev) => (prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    invite.mutate({
      email,
      name,
      reportsTo,
      level,
      batchIds,
      ...(baseZoneId ? { baseZoneId } : {}),
      ...(dateOfJoining ? { dateOfJoining } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(designation.trim() ? { designation: designation.trim() } : {}),
    });
  };

  const copyInvite = async () => {
    if (!invited) return;
    try {
      await navigator.clipboard.writeText(inviteText(invited));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions); the text stays selectable.
    }
  };

  const reset = () => {
    setEmail('');
    setName('');
    setLevel('L1');
    setReportsTo('');
    setBatchIds([]);
    setDateOfJoining('');
    setDepartmentId('');
    setDesignation('');
    setInvited(null);
    invite.reset();
  };

  if (invited) {
    return (
      <div className='max-w-xl space-y-4'>
        <h1 className='text-2xl font-semibold text-slate-800'>Invite sent · record ready</h1>
        <div className='rounded-xl border border-slate-200 bg-white p-5'>
          <p className='text-sm text-slate-700'>
            <span className='font-medium'>{invited.name}</span> — {invited.employeeCode} ·{' '}
            {invited.level} · {invited.email}
          </p>
          <p className='mt-1 text-xs text-slate-400'>
            Status: {invited.status} — becomes active when they claim their record.
            {invited.claim &&
              ' The invite link below is shown once — copy it now. A new one can be issued from HR → People.'}
          </p>
          <pre className='mt-4 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-600'>
            {inviteText(invited)}
          </pre>
          <div className='mt-3 flex gap-2'>
            <button
              type='button'
              onClick={copyInvite}
              className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500'
            >
              {copied ? 'Copied!' : 'Copy invite text'}
            </button>
            <button
              type='button'
              onClick={reset}
              className='rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50'
            >
              Invite another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='max-w-xl space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>Invite employee</h1>
      <p className='text-sm text-slate-500'>
        Access-first onboarding: you choose who joins and what they can do. The employee code
        is assigned automatically, and they fill in their own details after claiming their
        record. (HR&apos;s full add-employee form lives under HR → People.)
      </p>

      <form onSubmit={submit} className='space-y-4 rounded-xl border border-slate-200 bg-white p-5'>
        <div className='space-y-1'>
          <label className={labelClass}>Company email</label>
          <input
            type='email'
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            placeholder='new.hire@elecbits.in'
          />
        </div>

        <div className='space-y-1'>
          <label className={labelClass}>Full name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder='Asha Verma'
          />
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>Reporting manager</label>
            <select
              required
              value={reportsTo}
              onChange={(e) => setReportsTo(e.target.value)}
              className={inputClass}
            >
              <option value=''>Select a manager…</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — {m.employeeCode}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as Level)}
              className={inputClass}
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-1'>
            <label className={labelClass}>Department (optional)</label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={inputClass}
            >
              <option value=''>Not set</option>
              {(departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className='space-y-1'>
            <label className={labelClass}>Designation (optional)</label>
            <input
              value={designation}
              maxLength={120}
              onChange={(e) => setDesignation(e.target.value)}
              className={inputClass}
              placeholder='Firmware Engineer'
            />
          </div>
        </div>

        <div className='space-y-1'>
          <label className={labelClass}>Joining date (optional)</label>
          <input
            type='date'
            value={dateOfJoining}
            onChange={(e) => setDateOfJoining(e.target.value)}
            className={inputClass}
          />
          <p className='text-xs text-slate-400'>
            With a joining date, the onboarding checklist and the probation default apply from
            day one. Without it, the record shows up under HR&rsquo;s incomplete records.
          </p>
        </div>

        <div className='space-y-1'>
          <label className={labelClass}>Base location</label>
          <select
            value={baseZoneId}
            onChange={(e) => setBaseZoneId(e.target.value)}
            className={inputClass}
          >
            <option value=''>No base location</option>
            {(zones ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
                {z.workStart ? ` (${z.workStart}–${z.workEnd})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className='space-y-1'>
          <label className={labelClass}>Access batches to grant</label>
          <p className='text-xs text-slate-400'>
            The baseline Employee batch is attached automatically.
          </p>
          <div className='mt-1 space-y-1.5'>
            {grantableBatches.map((b) => (
              <label key={b.id} className='flex items-center gap-2 text-sm text-slate-700'>
                <input
                  type='checkbox'
                  checked={batchIds.includes(b.id)}
                  onChange={() => toggleBatch(b.id)}
                  className='rounded border-slate-300'
                />
                {b.name}
                {b.description && (
                  <span className='text-xs text-slate-400'>— {b.description}</span>
                )}
              </label>
            ))}
            {grantableBatches.length === 0 && (
              <p className='text-xs text-slate-400'>No extra batches defined yet.</p>
            )}
          </div>
        </div>

        {invite.error && (
          <p className='text-sm text-red-600'>{apiErrorMessage(invite.error)}</p>
        )}

        <div className='flex justify-end'>
          <button
            type='submit'
            disabled={invite.isPending}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            {invite.isPending ? 'Inviting…' : 'Create invite'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InviteEmployeePage;
