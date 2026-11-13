import { useQuery } from '@tanstack/react-query';

import { chipClass, fmtDay } from '@constants/Common/ops.constants';
import { meApi } from '@services/api/me.api';
import { opsApi } from '@services/api/ops.api';
import { holdsPortal } from '@utils/sections';

/**
 * Person sheet, OPS only: what they hold (read-only — changes happen in
 * Assets). Renders nothing for anyone without the OPS batch.
 */
const PersonAssets = ({ employeeId }: { employeeId: string }) => {
  const me = useQuery({ queryKey: ['me'], queryFn: meApi.get, staleTime: 60_000 });
  const isOps = !!me.data && holdsPortal(me.data, 'OPS');
  const held = useQuery({
    queryKey: ['ops-assets-of', employeeId],
    queryFn: () => opsApi.listAssets(employeeId),
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
    </section>
  );
};

export default PersonAssets;
