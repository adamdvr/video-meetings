import Person from '@gravity-ui/icons/Person';
import { Button, Skeleton } from '@heroui/react';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { logout } from '@/app/actions';
import { Logo } from '@/components/logo';
import { getSession } from '@/lib/session';

export function AppHeader() {
  return (
    <header className="border-b border-separator">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-4 sm:px-8">
        <Logo />
        <div className="flex min-h-10 w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-3 motion-reduce:[&_.skeleton::after]:animate-none sm:w-auto sm:flex-nowrap">
          <Suspense fallback={<AccountSkeleton />}>
            <Account />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function Account() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <>
      <div className="flex min-w-0 grow basis-40 items-center gap-3 sm:grow-0 sm:basis-auto">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-soft-foreground">
          <Person aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-xs text-muted">Вы вошли как</p>
          <p className="text-sm font-medium wrap-anywhere">{session.email}</p>
        </div>
      </div>
      <form action={logout}>
        <Button size="lg" type="submit" variant="secondary">
          Выйти
        </Button>
      </form>
    </>
  );
}

function AccountSkeleton() {
  return (
    <>
      <div aria-hidden="true" className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-4 w-40 rounded" />
        </div>
      </div>
      <Skeleton aria-hidden="true" className="h-11 w-20 rounded-xl md:h-10" />
    </>
  );
}
