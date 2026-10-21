import QuarterBoard from '@components/Common/QuarterReports/QuarterBoard.component';
import { PipQueue } from '@components/Common/Pip/PipLists.component';

/**
 * HR's CGP quarter reports: close a quarter (goals freeze, one report per
 * person), then read the team overview and each person's frozen record.
 */
const QuarterReportsPage = () => (
  <div className='w-full max-w-5xl space-y-4'>
    <div>
      <h1 className='text-2xl font-semibold text-slate-800'>Quarter reports</h1>
      <p className='mt-1 text-sm text-slate-500'>
        CGP score per person: 50% Fundamental + 25% Corporate + 25% General goals. Bands: E3 85+, E2
        70+, E1 50+, below 50. Managers (or HR) set the final score with a reason.
      </p>
    </div>
    <PipQueue />
    <QuarterBoard canClose />
  </div>
);

export default QuarterReportsPage;
