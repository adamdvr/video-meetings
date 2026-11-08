import ArrowLeft from '@gravity-ui/icons/ArrowLeft';
import Calendar from '@gravity-ui/icons/Calendar';
import Person from '@gravity-ui/icons/Person';
import { Alert, Card, Skeleton } from '@heroui/react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { MeetingDate } from '@/app/meeting-date';
import { RetryButton } from '@/app/retry-button';
import { AppHeader } from '@/components/app-header';
import { getMeeting, type Meeting } from '@/lib/meetings';

export async function generateMetadata({
  params,
}: PageProps<'/meetings/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (meeting === 'not-found') return { title: 'Встреча не найдена' };
  return { title: meeting?.title ?? 'Встреча' };
}

export default function MeetingPage({ params }: PageProps<'/meetings/[id]'>) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <Link
          className="-mx-1 inline-flex min-h-10 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-focus motion-reduce:transition-none"
          href="/"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Все встречи
        </Link>
        <Suspense fallback={<MeetingSkeleton />}>
          <MeetingDetails params={params} />
        </Suspense>
      </main>
    </div>
  );
}

async function MeetingDetails({
  params,
}: Pick<PageProps<'/meetings/[id]'>, 'params'>) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (meeting === 'not-found') return <NotFound />;
  if (!meeting) return <LoadError />;

  return (
    <>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight wrap-anywhere">
        {meeting.title}
      </h1>
      <p className="mt-3 flex items-center gap-2 text-muted">
        <Calendar aria-hidden="true" className="size-4 shrink-0" />
        <MeetingDate iso={meeting.date} />
      </p>
      <Participants participants={meeting.participants} />
    </>
  );
}

function Participants({
  participants,
}: {
  participants: Meeting['participants'];
}) {
  return (
    <section aria-labelledby="participants" className="mt-10">
      <h2 className="text-xl font-semibold tracking-tight" id="participants">
        Участники{' '}
        <span className="font-normal text-muted">({participants.length})</span>
      </h2>
      {participants.length === 0 ? (
        <Card className="mt-4 px-6 py-8 text-center text-muted">
          Участников нет
        </Card>
      ) : (
        <Card className="mt-4 gap-0 p-0">
          <ul
            aria-labelledby="participants"
            className="divide-y divide-separator"
          >
            {participants.map((participant, index) => (
              <li
                key={index}
                className="flex items-center gap-3 px-4 py-3 sm:px-6"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
                  <Person aria-hidden="true" className="size-4" />
                </span>
                <span className="min-w-0 wrap-anywhere">{participant}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  );
}

function NotFound() {
  return (
    <Card className="mt-6 items-center px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
        <Calendar aria-hidden="true" className="size-7" />
      </span>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        Встреча не найдена
      </h1>
      <p className="max-w-sm text-muted">
        Возможно, её удалили или ссылка неверна. Вернитесь к списку встреч.
      </p>
    </Card>
  );
}

function LoadError() {
  return (
    <Alert className="mt-6" role="alert" status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Не удалось загрузить встречу</Alert.Title>
        <Alert.Description>
          Сервер не ответил. Попробуйте ещё раз, а если ошибка повторяется,
          выйдите и войдите снова.
        </Alert.Description>
        <RetryButton />
      </Alert.Content>
    </Alert>
  );
}

function MeetingSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Загружаем встречу…</span>
      <div
        aria-hidden="true"
        className="motion-reduce:[&_.skeleton::after]:animate-none"
      >
        <Skeleton className="mt-4 h-9 w-2/3 rounded-md" />
        <Skeleton className="mt-3 h-6 w-56 rounded-md" />
        <Skeleton className="mt-10 h-7 w-40 rounded-md" />
        <Card className="mt-4 gap-0 p-0">
          <div className="divide-y divide-separator">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="flex items-center gap-3 px-4 py-3 sm:px-6"
              >
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-5 w-48 rounded-md" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
