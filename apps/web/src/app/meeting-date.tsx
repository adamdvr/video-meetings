'use client';

import { useSyncExternalStore } from 'react';

const options: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};
const localFormat = new Intl.DateTimeFormat('ru-RU', options);
const utcFormat = new Intl.DateTimeFormat('ru-RU', {
  ...options,
  timeZone: 'UTC',
  timeZoneName: 'short',
});
const subscribe = () => () => {};

export function MeetingDate({ iso }: { iso: string }) {
  const date = new Date(iso);
  const text = useSyncExternalStore(
    subscribe,
    () => localFormat.format(date),
    () => utcFormat.format(date),
  );

  return (
    <time className="tabular-nums" dateTime={iso}>
      {text}
    </time>
  );
}
