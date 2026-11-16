import { useQueries } from '@tanstack/react-query';

import type { PayrollRun } from '@app-types/api.types';
import { inrFull, inrShort } from '@components/Common/Charts/chartColors';
import ColumnChart from '@components/Common/Charts/ColumnChart.component';
import { payrollApi } from '@services/api/payroll.api';
import { payslipLines } from '@utils/payslipLines';

const monthLabel = (ym: string, style: 'short' | 'long') =>
  new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: style,
    year: style === 'long' ? 'numeric' : '2-digit',
  });

/**
 * Month on month (PR): gross earnings and net pay of the last 12 finalised or
 * paid runs — drafts can still change, so they stay out. Both are ₹ on one
 * axis, summed with the SAME lines as each payslip (Total earnings, and
 * earnings − deductions = Net pay). Run details share the run-detail cache.
 */
const PayrollTrend = ({ runs }: { runs: PayrollRun[] }) => {
  const closed = runs
    .filter((r) => r.status !== 'draft')
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12);
  const drafts = runs.filter((r) => r.status === 'draft').length;

  const details = useQueries({
    queries: closed.map((r) => ({
      queryKey: ['payroll-run', r.id],
      queryFn: () => payrollApi.getRun(r.id),
      staleTime: 5 * 60_000,
    })),
  });

  if (closed.length < 2) {
    return (
      <p className='rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500'>
        The month-on-month chart appears once two runs are finalised.
      </p>
    );
  }
  if (details.some((d) => d.isLoading)) {
    return <p className='text-sm text-slate-500'>Loading the trend…</p>;
  }

  const points = closed.map((r, i) => {
    const slips = details[i]?.data?.payslips ?? [];
    let gross = 0;
    let deductions = 0;
    for (const s of slips) {
      const lines = payslipLines(s);
      gross += lines.totalEarnings;
      deductions += lines.totalDeductions;
    }
    return {
      key: r.id,
      label: monthLabel(r.month, 'short'),
      title: monthLabel(r.month, 'long'),
      values: [gross, gross - deductions],
      note: `${r.payslipCount} payslips · ${r.status === 'paid' ? 'paid' : 'finalised'}`,
    };
  });
  const latest = points[points.length - 1]!;

  return (
    <ColumnChart
      title='Month on month — gross and net'
      series={[
        { key: 'gross', label: 'Gross earnings' },
        { key: 'net', label: 'Net pay' },
      ]}
      points={points}
      format={inrFull}
      axisFormat={inrShort}
      footnote={`Latest (${latest.title}): gross ${inrFull(latest.values[0]!)}, net ${inrFull(
        latest.values[1]!,
      )}.${drafts > 0 ? ` ${drafts} draft run${drafts === 1 ? '' : 's'} left out until finalised.` : ''}`}
    />
  );
};

export default PayrollTrend;
