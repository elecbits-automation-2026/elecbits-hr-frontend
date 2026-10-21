/**
 * The intentional stub: a screen that exists in the route table before its
 * real UI does. Keeping stubs visible (rather than 404ing) lets navigation,
 * guards, and titles be wired end-to-end from day one.
 */
const PlaceholderScreen = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => (
  <div className='flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center'>
    <h1 className='text-2xl font-semibold text-slate-800'>{title}</h1>
    <p className='max-w-md text-sm text-slate-500'>
      {description ?? 'This module is scaffolded and waiting for its screens.'}
    </p>
  </div>
);

export default PlaceholderScreen;
