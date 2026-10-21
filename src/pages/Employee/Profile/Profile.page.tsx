import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Me, PersonRef, UpdateMeInput } from '@app-types/api.types';
import { meApi } from '@services/api/me.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm';
const labelClass = 'block text-xs font-medium text-slate-600';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'company', label: 'Company' },
  { key: 'joining', label: 'Joining' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'address', label: 'Address' },
  { key: 'approvers', label: 'Approvers' },
  { key: 'salary', label: 'Salary & Bank' },
  { key: 'assets', label: 'Assets' },
  { key: 'exit', label: 'Exit' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const SALUTATIONS = ['Mr', 'Mrs', 'Ms', 'Mx', 'Dr', 'Prof'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

/** A read-only fact HR owns (code, level, department, manager). */
const Fact = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className={labelClass}>{label}</div>
    <div className='mt-1 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500'>{value}</div>
  </div>
);

const person = (ref: PersonRef) => (ref ? `${ref.name} (${ref.employeeCode})` : '—');
const dash = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : String(value);

/** One editable field; empty string travels as null so clearing works. */
const Field = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) => (
  <div className='space-y-1'>
    <label className={labelClass}>{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
      placeholder={placeholder}
    />
  </div>
);

const SelectField = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) => (
  <div className='space-y-1'>
    <label className={labelClass}>{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      <option value=''>—</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  </div>
);

/** The editable fields, as the form holds them ('' = unset). */
interface FormState {
  salutation: string;
  firstName: string;
  middleName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  phone: string;
  personalEmail: string;
  preferredContactEmail: string;
  currentAddress: string;
  permanentAddress: string;
}

/**
 * Records created before the name parts existed only hold the full name —
 * split it for display: two words are first + last for sure; more than two
 * put everything between them in the middle.
 */
const splitName = (full: string): { first: string; middle: string; last: string } => {
  const words = full.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { first: words[0] ?? '', middle: '', last: '' };
  if (words.length === 2) return { first: words[0]!, middle: '', last: words[1]! };
  return { first: words[0]!, middle: words.slice(1, -1).join(' '), last: words.at(-1)! };
};

const toForm = (me: Me): FormState => {
  const parts =
    me.firstName === null && me.lastName === null ? splitName(me.name) : undefined;
  return {
    salutation: me.salutation ?? '',
    firstName: me.firstName ?? parts?.first ?? '',
    middleName: me.middleName ?? parts?.middle ?? '',
    lastName: me.lastName ?? parts?.last ?? '',
    gender: me.gender ?? '',
    dateOfBirth: me.dateOfBirth ?? '',
    phone: me.phone ?? '',
    personalEmail: me.personalEmail ?? '',
    preferredContactEmail: me.preferredContactEmail ?? '',
    currentAddress: me.currentAddress ?? '',
    permanentAddress: me.permanentAddress ?? '',
  };
};

const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

/**
 * ERPNext-style employee profile in tabs. Personal identity fields are
 * self-serve (decision D3); company placement, joining terms and approvers are
 * org-controlled and read-only here — HRBP changes those through People.
 * Salary & Bank is ME-SCOPED (§3.1): the backend serves only the caller's own
 * row, and other people's salary needs the PR compensation module.
 */
const ProfilePage = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('overview');
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: me, isLoading, error } = useQuery({ queryKey: ['me'], queryFn: meApi.get });

  // Private data is fetched only when its tab opens.
  const salary = useQuery({
    queryKey: ['me', 'salary'],
    queryFn: meApi.getSalary,
    enabled: tab === 'salary',
  });
  const assets = useQuery({
    queryKey: ['me', 'assets'],
    queryFn: meApi.listAssets,
    enabled: tab === 'assets',
  });
  const exit = useQuery({
    queryKey: ['me', 'exit'],
    queryFn: meApi.getExit,
    enabled: tab === 'exit',
  });

  // Seed the form once the profile arrives (and after outside refreshes).
  useEffect(() => {
    if (me) setForm(toForm(me));
  }, [me]);

  const update = useMutation({
    mutationFn: meApi.update,
    onSuccess: (fresh) => {
      queryClient.setQueryData(['me'], fresh);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const set = (key: keyof FormState) => (v: string) =>
    setForm((f) => (f ? { ...f, [key]: v } : f));

  const editableTab = tab === 'overview' || tab === 'contacts' || tab === 'address';

  const patchForTab = useMemo((): UpdateMeInput => {
    if (!form) return {};
    if (tab === 'overview') {
      return {
        salutation: orNull(form.salutation),
        firstName: form.firstName.trim() || undefined,
        middleName: orNull(form.middleName),
        lastName: orNull(form.lastName),
        gender: orNull(form.gender),
        dateOfBirth: orNull(form.dateOfBirth),
      };
    }
    if (tab === 'contacts') {
      return {
        phone: orNull(form.phone),
        personalEmail: orNull(form.personalEmail),
        preferredContactEmail:
          form.preferredContactEmail === 'company' || form.preferredContactEmail === 'personal'
            ? form.preferredContactEmail
            : null,
      };
    }
    return {
      currentAddress: orNull(form.currentAddress),
      permanentAddress: orNull(form.permanentAddress),
    };
  }, [form, tab]);

  if (isLoading) return <p className='text-sm text-slate-500'>Loading…</p>;
  if (error || !me || !form) return <p className='text-sm text-red-600'>{apiErrorMessage(error)}</p>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate(patchForTab);
  };

  const grid = (children: ReactNode) => (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4'>
      {children}
    </div>
  );

  const tabContent: Record<TabKey, ReactNode> = {
    overview: grid(
      <>
        <SelectField label='Salutation' value={form.salutation} onChange={set('salutation')} options={SALUTATIONS} />
        <Field label='First name' value={form.firstName} onChange={set('firstName')} />
        <Field label='Middle name' value={form.middleName} onChange={set('middleName')} />
        <Field label='Last name' value={form.lastName} onChange={set('lastName')} />
        <Fact label='Full name' value={me.name} />
        <SelectField label='Gender' value={form.gender} onChange={set('gender')} options={GENDERS} />
        <Field label='Date of birth' type='date' value={form.dateOfBirth} onChange={set('dateOfBirth')} />
        <Fact label='Series (employee code)' value={me.employeeCode} />
        <Fact label='Date of joining' value={dash(me.dateOfJoining)} />
        <Fact label='Status' value={me.status} />
      </>,
    ),
    company: grid(
      <>
        <Fact label='Company' value='Elecbits' />
        <Fact label='Designation' value={dash(me.designation)} />
        <Fact label='Department' value={me.department?.name ?? '—'} />
        <Fact label='Base location' value={me.baseZone?.name ?? '—'} />
        <Fact label='Reports to' value={person(me.manager)} />
        <Fact label='Level' value={me.level} />
        <Fact label='Employment type' value={dash(me.employmentType)} />
      </>,
    ),
    joining: grid(
      <>
        <Fact label='Offer date' value={dash(me.offerDate)} />
        <Fact label='Confirmation date' value={dash(me.confirmationDate)} />
        <Fact label='Notice (days)' value={dash(me.noticeDays)} />
      </>,
    ),
    contacts: grid(
      <>
        <Field
          label='Mobile'
          value={form.phone}
          // 10 digits exactly (user decision): strip non-digits, cap at 10.
          onChange={(v) => set('phone')(v.replace(/\D/g, '').slice(0, 10))}
        />
        <Field label='Personal email' type='email' value={form.personalEmail} onChange={set('personalEmail')} />
        <Fact label='Company email' value={me.email} />
        <SelectField
          label='Preferred contact email'
          value={form.preferredContactEmail}
          onChange={set('preferredContactEmail')}
          options={['company', 'personal']}
        />
      </>,
    ),
    address: (
      <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
        <div className='space-y-1'>
          <label className={labelClass}>Current address</label>
          <textarea
            value={form.currentAddress}
            onChange={(e) => set('currentAddress')(e.target.value)}
            className={`${inputClass} min-h-28`}
          />
        </div>
        <div className='space-y-1'>
          <label className={labelClass}>Permanent address</label>
          <textarea
            value={form.permanentAddress}
            onChange={(e) => set('permanentAddress')(e.target.value)}
            className={`${inputClass} min-h-28`}
          />
        </div>
      </div>
    ),
    approvers: grid(
      <>
        <Fact label='Expense approver' value={person(me.expenseApprover)} />
        <Fact label='Shift request approver' value={person(me.shiftRequestApprover)} />
        <Fact label='Leave approver' value={person(me.leaveApprover)} />
      </>,
    ),
    salary: (
      <div className='space-y-4'>
        <p className='rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800'>
          Private to you. Only you, Payroll (PR) and the Owner can see this tab — other HR and
          your manager cannot.
        </p>
        {salary.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {salary.error && <p className='text-sm text-red-600'>{apiErrorMessage(salary.error)}</p>}
        {salary.data && (
          <>
            {grid(
              <>
                <Fact
                  label='Cost to Company (CTC)'
                  value={
                    salary.data.ctc ? `${salary.data.salaryCurrency} ${salary.data.ctc}` : '—'
                  }
                />
                <Fact label='Payroll cost center' value={dash(salary.data.payrollCostCenter)} />
                <Fact label='Salary currency' value={salary.data.salaryCurrency} />
                <Fact label='Salary mode' value={dash(salary.data.salaryMode)} />
                <Fact label='PAN number' value={dash(salary.data.panNumber)} />
                <Fact label='Provident fund account' value={dash(salary.data.providentFundAccount)} />
                <Fact label='Employee advance account' value={dash(salary.data.employeeAdvanceAccount)} />
                <Fact
                  label='Structure (basic / HRA %)'
                  value={`${salary.data.basicPercent ?? '50'} / ${salary.data.hraPercent ?? '25'}`}
                />
                <Fact label='Monthly PF' value={dash(salary.data.pfAmount)} />
                <Fact label='Monthly TDS' value={dash(salary.data.tdsAmount)} />
                <Fact label='Professional tax' value={dash(salary.data.professionalTaxAmount)} />
                <Fact label='Other deduction' value={dash(salary.data.otherDeductionAmount)} />
              </>,
            )}
            <div>
              <p className='mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400'>
                Bank details
              </p>
              {grid(
                <>
                  <Fact label='Bank name' value={dash(salary.data.bankName)} />
                  <Fact label='Bank A/C no.' value={dash(salary.data.bankAccountNo)} />
                  <Fact label='IFSC code' value={dash(salary.data.ifscCode)} />
                </>,
              )}
            </div>
            <p className='text-xs text-slate-400'>
              Corrections go through Payroll — these fields are not self-serve.
            </p>
          </>
        )}
      </div>
    ),
    assets: (
      <div className='space-y-3'>
        {assets.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {assets.error && <p className='text-sm text-red-600'>{apiErrorMessage(assets.error)}</p>}
        {assets.data &&
          (assets.data.length === 0 ? (
            <p className='text-sm text-slate-500'>No assets are assigned to you.</p>
          ) : (
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b border-slate-200 text-xs text-slate-500'>
                  <th className='py-2 pr-3 font-medium'>Code</th>
                  <th className='py-2 pr-3 font-medium'>Name</th>
                  <th className='py-2 pr-3 font-medium'>Category</th>
                  <th className='py-2 font-medium'>Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.data.map((a) => (
                  <tr key={a.id} className='border-b border-slate-100'>
                    <td className='py-2 pr-3 font-mono text-xs'>{a.assetCode}</td>
                    <td className='py-2 pr-3'>{a.name}</td>
                    <td className='py-2 pr-3'>{dash(a.category)}</td>
                    <td className='py-2'>{a.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </div>
    ),
    exit: (
      <div className='space-y-3'>
        {exit.isLoading && <p className='text-sm text-slate-500'>Loading…</p>}
        {exit.error && <p className='text-sm text-red-600'>{apiErrorMessage(exit.error)}</p>}
        {exit.data === null && (
          <p className='text-sm text-slate-500'>
            No exit on record — start one from the Resignation page if you are leaving.
          </p>
        )}
        {exit.data && (
          <>
            {grid(
              <>
                <Fact
                  label='Type'
                  value={exit.data.kind === 'resignation' ? 'Resignation' : 'Termination'}
                />
                <Fact label='Status' value={exit.data.status} />
                <Fact label='Notice from' value={exit.data.noticeStartOn} />
                <Fact label='Last working day' value={exit.data.lastWorkingDay} />
                <Fact
                  label='Exit interview'
                  value={exit.data.interviewAt ? 'Filled' : 'Not yet'}
                />
                <Fact
                  label='Full & final'
                  value={exit.data.settledAt ? 'Settled' : 'Not yet'}
                />
              </>,
            )}
            <p className='text-sm text-slate-500'>
              Details, clearances and the exit interview are on the Resignation page.
            </p>
          </>
        )}
      </div>
    ),
  };

  return (
    <div className='w-full space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>My profile</h1>

      <div className='flex flex-wrap gap-1 border-b border-slate-200'>
        {TABS.map((t) => (
          <button
            key={t.key}
            type='button'
            onClick={() => setTab(t.key)}
            className={`-mb-px rounded-t-md px-3 py-2 text-sm ${
              tab === t.key
                ? 'border border-b-white border-slate-200 bg-white font-medium text-brand-600'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className='space-y-4 rounded-xl border border-slate-200 bg-white p-5'>
        {tabContent[tab]}

        {update.error && <p className='text-sm text-red-600'>{apiErrorMessage(update.error)}</p>}

        {editableTab && (
          <div className='flex items-center justify-end gap-3'>
            {saved && <span className='text-xs text-green-600'>Saved</span>}
            <button
              type='submit'
              disabled={update.isPending}
              className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
            >
              {update.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default ProfilePage;
