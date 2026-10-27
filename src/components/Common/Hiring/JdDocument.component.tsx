import { createPortal } from 'react-dom';

import type { JdContent } from '@app-types/api.types';
import {
  JD_ABOUT_ELECBITS,
  JD_FOOTER,
  JD_WHY_JOIN,
} from '@constants/Common/jdTemplate.constants';

/** Old or half-filled content still renders: missing parts show as empty. */
const list = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 className='font-serif text-2xl text-slate-900'>{children}</h2>
);

/**
 * The JD laid out like the company template (Test Portal JD): navy Elecbits
 * header, the job type / city / CTC strip, "Job Role –", the fixed company
 * text around the recruiter's role-specific parts, and the office footer.
 */
export const JdPage = ({ c, roleTitle }: { c: Partial<JdContent>; roleTitle: string }) => (
  <article className='jd-page mx-auto w-full max-w-[794px] bg-[#f8faff] text-slate-800 shadow-lg print:shadow-none'>
    <header>
      <div className='flex h-14 items-center bg-[#000080] px-8'>
        <span className='text-xl font-bold tracking-tight text-white'>Elecbits</span>
      </div>
      <div className='h-2 bg-[#cfe2f3]' />
    </header>

    <div className='space-y-8 px-6 py-8 sm:px-10'>
      <div className='grid grid-cols-1 gap-4 rounded bg-[#eef4ff] p-5 sm:grid-cols-3'>
        {(
          [
            ['Job Type', text(c.jobType)],
            ['City', text(c.city)],
            ['Cost to Company', text(c.ctc)],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <p className='font-bold text-slate-900'>{k}</p>
            <p className='mt-1 text-sm'>{v || '—'}</p>
          </div>
        ))}
      </div>

      <div className='px-2'>
        <p className='font-serif text-4xl text-[#1155ff] sm:text-5xl'>Job Role–</p>
        <p className='font-serif text-3xl text-slate-900 sm:text-4xl'>{roleTitle}</p>
      </div>

      <section className='space-y-3 px-2'>
        <Heading>About Elecbits</Heading>
        {JD_ABOUT_ELECBITS.map((p) => (
          <p key={p.slice(0, 20)} className='text-sm leading-7'>
            {p}
          </p>
        ))}
      </section>

      <section className='space-y-2 px-2'>
        <Heading>About the Business Unit —</Heading>
        <p className='whitespace-pre-wrap text-sm leading-7'>{text(c.businessUnit)}</p>
      </section>

      <section className='space-y-2 px-2'>
        <Heading>Role Summary</Heading>
        <p className='whitespace-pre-wrap text-sm leading-7'>{text(c.roleSummary)}</p>
      </section>

      <section className='space-y-2 px-2'>
        <h3 className='text-lg font-bold text-slate-900'>Key Responsibilities</h3>
        <ul className='list-disc space-y-1 pl-6 text-sm leading-7'>
          {list(c.responsibilities).map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      </section>

      <div className='grid gap-8 px-2 sm:grid-cols-2 print:grid-cols-2'>
        <section className='space-y-3'>
          <h3 className='text-lg font-bold text-slate-900'>Why Join Us?</h3>
          {JD_WHY_JOIN.map((w) => (
            <div key={w.title}>
              <p className='font-serif text-lg text-[#1155ff]'>{w.title}</p>
              <p className='text-sm leading-7'>{w.text}</p>
            </div>
          ))}
        </section>
        <section className='space-y-3'>
          <h3 className='text-lg font-bold text-slate-900'>Must-Have Skills-:</h3>
          <div>
            <p className='text-sm font-semibold'>Required</p>
            <ul className='list-disc space-y-1 pl-5 text-sm leading-6'>
              {list(c.requiredSkills).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
          {list(c.preferredSkills).length > 0 && (
            <div>
              <p className='text-sm font-semibold'>Preferred</p>
              <ul className='list-disc space-y-1 pl-5 text-sm leading-6'>
                {list(c.preferredSkills).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>

    <footer className='border-t border-slate-200 bg-white px-6 py-4 text-xs italic text-slate-600 sm:px-10'>
      <p>
        <span className='font-semibold'>Corporate office:</span> {JD_FOOTER.office}
      </p>
      <p>
        <span className='font-semibold'>Phone:</span> {JD_FOOTER.phone} |{' '}
        <span className='font-semibold'>Email:</span>{' '}
        <a href={`mailto:${JD_FOOTER.email}`} className='text-blue-700 underline'>
          {JD_FOOTER.email}
        </a>
      </p>
    </footer>
  </article>
);

/**
 * Full-screen preview of a JD with Print / Save as PDF. Rendered into
 * <body> so the print stylesheet (index.css) can print it alone.
 */
const JdDocument = ({
  c,
  roleTitle,
  onClose,
}: {
  c: Partial<JdContent>;
  roleTitle: string;
  onClose: () => void;
}) =>
  createPortal(
    <div className='jd-print-root fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 print:static print:bg-white print:p-0'>
      <div className='mx-auto mb-3 flex max-w-[794px] justify-end gap-2 print:hidden'>
        <button
          type='button'
          onClick={() => window.print()}
          className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
        >
          Print / Save as PDF
        </button>
        <button
          type='button'
          onClick={onClose}
          className='rounded-md border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50'
        >
          Close
        </button>
      </div>
      <JdPage c={c} roleTitle={roleTitle} />
    </div>,
    document.body,
  );

export default JdDocument;
