import Calendar from '@gravity-ui/icons/Calendar';
import Persons from '@gravity-ui/icons/Persons';
import { Alert, Card } from '@heroui/react';
import Link from 'next/link';
import {
  getMeetings,
  LATEST_MEETINGS_COUNT,
  sortByDateDesc,
  type Meeting,
} from '@/lib/meetings';
import { MeetingDate } from './meeting-date';
import { RetryButton } from './retry-button';

const pluralRules = new Intl.PluralRules('ru');

function participantsLabel(count: number) {
  if (count === 0) return 'Без участников';
  switch (pluralRules.select(count)) {
    case 'one':
      return `${count} участник`;
    case 'few':
      return `${count} участника`;
    default:
      return `${count} участников`;
  }
}

export async function MeetingsSection() {
  const meetings = await getMeetings();
  if (!meetings) return <LoadError />;
  if (meetings.length === 0) return <EmptyState />;

  const sorted = sortByDateDesc(meetings);

  return (
    <>
      <section aria-labelledby="latest-meetings" className="mt-10">
        <h2
          className="text-xl font-semibold tracking-tight"
          id="latest-meetings"
        >
          Последние встречи
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.slice(0, LATEST_MEETINGS_COUNT).map((meeting) => (
            <li key={meeting.id}>
              <MeetingCard meeting={meeting} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="all-meetings" className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight" id="all-meetings">
          Все встречи{' '}
          <span className="font-normal text-muted">({meetings.length})</span>
        </h2>
        <Card className="mt-4 gap-0 p-0">
          <ul className="divide-y divide-separator rounded-[inherit]">
            {sorted.map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} />
            ))}
          </ul>
        </Card>
      </section>
    </>
  );
}

function DateLine({ iso }: { iso: string }) {
  return (
    <p className="flex items-center gap-2">
      <Calendar aria-hidden="true" className="size-4 shrink-0" />
      <MeetingDate iso={iso} />
    </p>
  );
}

function ParticipantsLine({ count }: { count: number }) {
  return (
    <p className="flex items-center gap-2">
      <Persons aria-hidden="true" className="size-4 shrink-0" />
      {participantsLabel(count)}
    </p>
  );
}

function MeetingLink({ meeting }: { meeting: Meeting }) {
  return (
    <Link
      className="outline-none after:absolute after:inset-0 after:rounded-[inherit]"
      href={`/meetings/${meeting.id}`}
    >
      {meeting.title}
    </Link>
  );
}

function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <Card className="relative h-full transition-colors outline-focus hover:bg-surface-secondary has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 motion-reduce:transition-none">
      <Card.Header>
        <Card.Title className="text-base leading-6 font-semibold wrap-anywhere">
          <MeetingLink meeting={meeting} />
        </Card.Title>
      </Card.Header>
      <Card.Content className="gap-2 text-sm text-muted">
        <DateLine iso={meeting.date} />
        <ParticipantsLine count={meeting.participants.length} />
      </Card.Content>
    </Card>
  );
}

function MeetingRow({ meeting }: { meeting: Meeting }) {
  return (
    <li className="relative flex flex-col gap-2 px-4 py-4 transition-colors outline-focus -outline-offset-2 first:rounded-t-[inherit] last:rounded-b-[inherit] hover:bg-surface-secondary has-[a:focus-visible]:outline-2 motion-reduce:transition-none sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
      <p className="min-w-0 font-medium wrap-anywhere">
        <MeetingLink meeting={meeting} />
      </p>
      <div className="flex flex-col gap-1.5 text-sm text-muted sm:flex-row sm:gap-x-6 lg:grid lg:shrink-0 lg:grid-cols-[15rem_9rem]">
        <DateLine iso={meeting.date} />
        <ParticipantsLine count={meeting.participants.length} />
      </div>
    </li>
  );
}

function EmptyState() {
  return (
    <Card className="mt-8 items-center px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
        <Calendar aria-hidden="true" className="size-7" />
      </span>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">
        Встреч пока нет
      </h2>
      <p className="max-w-sm text-muted">
        Когда вы создадите встречу, она появится здесь.
      </p>
    </Card>
  );
}

function LoadError() {
  return (
    <Alert className="mt-8" role="alert" status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Не удалось загрузить встречи</Alert.Title>
        <Alert.Description>
          Сервер не ответил. Попробуйте ещё раз, а если ошибка повторяется,
          выйдите и войдите снова.
        </Alert.Description>
        <RetryButton />
      </Alert.Content>
    </Alert>
  );
}
