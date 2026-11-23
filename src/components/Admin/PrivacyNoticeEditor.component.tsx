import { useState, type FormEvent, type ReactNode } from 'react';

import { inputClass } from '@constants/Common/ops.constants';

interface PrivacyNotice {
  version: string;
  text: string;
}

/**
 * Editor for the `privacy.notice` setting: the notice text and its version.
 * Changing the version asks everyone to accept again at their next visit, so
 * the editor says so when the text changed but the version did not.
 */
const PrivacyNoticeEditor = ({
  value,
  onSave,
  children,
}: {
  value: PrivacyNotice;
  onSave: (v: PrivacyNotice) => void;
  children?: ReactNode;
}) => {
  const [draft, setDraft] = useState(value);
  const textChanged = draft.text.trim() !== value.text.trim();
  const versionSame = draft.version.trim() === value.version.trim();

  return (
    <form
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSave({ version: draft.version.trim(), text: draft.text.trim() });
      }}
      className='space-y-3'
    >
      <label className='block text-xs text-slate-600'>
        Version (change it to ask everyone to accept again)
        <input
          type='text'
          value={draft.version}
          maxLength={40}
          onChange={(e) => setDraft({ ...draft, version: e.target.value })}
          className={`${inputClass} mt-1 block w-48`}
        />
      </label>
      <label className='block text-xs text-slate-600'>
        Notice text
        <textarea
          value={draft.text}
          rows={14}
          maxLength={20_000}
          onChange={(e) => setDraft({ ...draft, text: e.target.value })}
          className={`${inputClass} mt-1 block w-full font-mono text-xs leading-relaxed`}
        />
      </label>
      {textChanged && versionSame && (
        <p className='text-xs text-amber-700'>
          The text changed but the version did not — people who already accepted won&rsquo;t be
          asked to read it again.
        </p>
      )}
      {children}
    </form>
  );
};

export default PrivacyNoticeEditor;
