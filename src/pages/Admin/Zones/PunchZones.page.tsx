import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { attendanceApi } from '@services/api/attendance.api';
import { apiErrorMessage } from '@utils/apiError';

const inputClass = 'rounded-md border border-slate-300 px-3 py-2 text-sm';

/**
 * Punch zones (Admin): the places people may check in/out from. A punch
 * inside ANY zone is a clean office punch; outside every zone it's blocked
 * unless a remote-work request covers the day.
 */
const PunchZonesPage = () => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radiusM, setRadiusM] = useState('250');
  const [workStart, setWorkStart] = useState('');
  const [workEnd, setWorkEnd] = useState('');

  const zones = useQuery({ queryKey: ['punch-zones'], queryFn: attendanceApi.listZones });

  const addZone = useMutation({
    mutationFn: attendanceApi.addZone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punch-zones'] });
      setName('');
      setLat('');
      setLng('');
      setRadiusM('250');
      setWorkStart('');
      setWorkEnd('');
    },
  });
  const removeZone = useMutation({
    mutationFn: attendanceApi.removeZone,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['punch-zones'] }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    addZone.mutate({
      name: name.trim(),
      lat: Number(lat),
      lng: Number(lng),
      radiusM: Number(radiusM) || 250,
      workStart: workStart || null,
      workEnd: workEnd || null,
    });
  };

  return (
    <div className='w-full max-w-3xl space-y-4'>
      <h1 className='text-2xl font-semibold text-slate-800'>Punch zones</h1>
      <p className='text-sm text-slate-500'>
        Employees can check in/out from inside any zone below (checking in at one and out at
        another is fine). Outside every zone, punching needs an approved remote-work request.
      </p>

      <div className='rounded-xl border border-slate-200 bg-white p-5'>
        <form onSubmit={submit} className='mb-4 flex flex-wrap items-end gap-2'>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder='Zone name (e.g. HQ, Warehouse)' className={inputClass} />
          <input required type='number' step='any' min={-90} max={90} value={lat} onChange={(e) => setLat(e.target.value)} placeholder='Latitude' className={`${inputClass} w-32`} />
          <input required type='number' step='any' min={-180} max={180} value={lng} onChange={(e) => setLng(e.target.value)} placeholder='Longitude' className={`${inputClass} w-32`} />
          <input type='number' min={1} max={5000} value={radiusM} onChange={(e) => setRadiusM(e.target.value)} placeholder='Radius (m)' className={`${inputClass} w-28`} />
          <label className='text-xs text-slate-500'>
            Hours
            <input type='time' value={workStart} onChange={(e) => setWorkStart(e.target.value)} className={`${inputClass} ml-1`} />
          </label>
          <label className='text-xs text-slate-500'>
            to
            <input type='time' value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className={`${inputClass} ml-1`} />
          </label>
          <button
            type='submit'
            disabled={addZone.isPending}
            className='rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 disabled:opacity-50'
          >
            Add zone
          </button>
        </form>
        {(addZone.error ?? removeZone.error ?? zones.error) && (
          <p className='mb-2 text-sm text-red-600'>
            {apiErrorMessage(addZone.error ?? removeZone.error ?? zones.error)}
          </p>
        )}

        {zones.data && zones.data.length === 0 && (
          <p className='text-sm text-slate-500'>
            No zones yet — punches fall back to the office configured in the backend .env.
          </p>
        )}
        {zones.data?.map((z) => (
          <div key={z.id} className='flex items-center justify-between border-b border-slate-100 py-2 text-sm'>
            <span>
              <b>{z.name}</b>
              <span className='ml-2 font-mono text-xs text-slate-400'>
                {z.lat}, {z.lng} · {z.radiusM}m ·{' '}
                {z.workStart ? `${z.workStart}–${z.workEnd}` : 'default hours'}
              </span>
            </span>
            <button
              type='button'
              disabled={removeZone.isPending}
              onClick={() => removeZone.mutate(z.id)}
              className='text-xs text-slate-400 hover:text-red-600'
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PunchZonesPage;
