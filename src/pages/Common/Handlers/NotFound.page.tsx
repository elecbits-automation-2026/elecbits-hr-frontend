import { Link } from 'react-router-dom';

import { HOME_ROUTE } from '@constants/Common/navigation/routes.constants';

/** Outside every shell: an unmatched URL cannot assume a console's chrome. */
const NotFoundPage = () => (
  <div className='flex min-h-screen flex-col items-center justify-center gap-3'>
    <h1 className='text-3xl font-bold text-slate-800'>404</h1>
    <p className='text-sm text-slate-500'>This page does not exist.</p>
    <Link to={HOME_ROUTE} className='text-sm font-medium text-brand-600 hover:underline'>
      Back to home
    </Link>
  </div>
);

export default NotFoundPage;
