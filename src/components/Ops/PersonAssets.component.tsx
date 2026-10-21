import { useQuery } from '@tanstack/react-query';

import { chipClass, fmtDay } from '@constants/Common/ops.constants';
import { meApi } from '@services/api/me.api';
import { opsApi } from '@services/api/ops.api';
import { holdsPortal } from '@utils/sections';

/**
 * Person sheet, OPS only: what they hold (read-only — changes happen in
 * Assets) and their designation's joiner kit against it. Renders nothing for
 * anyone without the OPS batch.
 */
const PersonAssets = ({ employeeId }: { employeeId: string }) => {
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const isOps = !!me.data && holdsPortal(me.data, 'OPS');
  const held = useQuery({
    queryKey: ['ops-assets-of', employeeId],
    queryFn: () => opsApi.listAssets(employeeId),
    enabled: isOps,
  });
  const kit = useQuery({
    queryKey: ['ops-kit-check', employeeId],
    queryFn: () => opsApi.kitCheck(employeeId),
    enabled: isOps,
  });
  if (!isOps) return null;

  return (
    <section className='rounded-xl border border-slate-200 bg-white p-4'>
      <h3 className='mb-2 text-sm font-semibold text-slate-700'>Assets held</h3>
      {held.data?.length === 0 && <p className='text-sm text-slate-400'>Nothing assigned.</p>}
      <ul className='space-y-1 text-sm'>
        {held.data?.map((a) => (
          <li key={a.id} className='flex flex-wrap items-center gap-2'>
            <span className='font-mono text-xs text-slate-400'>{a.assetCode}</span>
            <span className='text-slate-700'>{a.name}</span>
            <span className='text-xs text-slate-400'>{a.category.name}</span>
            {a.loanDueOn && (
              <span
                className={`${chipClass} ${a.loanOverdue ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}
              >
                lent until {fmtDay(a.loanDueOn)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {kit.data && kit.data.items.length > 0 && (
        <div className='mt-3 border-t border-slate-100 pt-2'>
          <p className='text-xs font-medium text-slate-500'>Joiner kit · {kit.data.designation}</p>
          <ul className='mt-1 flex flex-wrap gap-1.5'>
            {kit.data.items.map((i) => (
              <li
                key={i.categoryId}
                className={`${chipClass} ${i.held >= i.qty ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-800'}`}
              >
                {i.held >= i.qty ? '✓' : '○'} {i.categoryName} {Math.min(i.held, i.qty)}/{i.qty}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default PersonAssets;
