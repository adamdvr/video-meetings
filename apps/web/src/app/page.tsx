import { Button } from '@heroui/react';
import { Suspense } from 'react';
import { AppHeader } from '@/components/app-header';
import { MeetingsSection } from './meetings-section';
import { MeetingsSkeleton } from './meetings-skeleton';

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <AppHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">
            Ваши встречи
          </h1>
          <Button size="lg">Создать встречу</Button>
        </div>
        <Suspense fallback={<MeetingsSkeleton />}>
          <MeetingsSection />
        </Suspense>
      </main>
    </div>
  );
}
