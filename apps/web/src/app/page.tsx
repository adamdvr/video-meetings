import { Button } from '@heroui/react';
import { Suspense } from 'react';
import { getSession } from '@/lib/session';
import { logout } from './actions';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">Video meetings</h1>
      {/* Сессия читается из cookie на каждый запрос, поэтому блок стримится вне статической оболочки.
          Высота зарезервирована (кнопки и подпись в две строки), чтобы заголовок не прыгал, когда блок подгрузится. */}
      <div className="flex min-h-24 flex-col items-center gap-4">
        <Suspense>
          <SessionActions />
        </Suspense>
      </div>
    </main>
  );
}

async function SessionActions() {
  const session = await getSession();

  return (
    <>
      <div className="flex gap-3">
        <Button>Создать встречу</Button>
        {session ? (
          <form action={logout}>
            <Button type="submit" variant="secondary">
              Выйти
            </Button>
          </form>
        ) : (
          <Button variant="secondary">Войти</Button>
        )}
      </div>
      {session && (
        <p className="max-w-xs text-center text-sm text-muted">
          Вы вошли как{' '}
          <span className="inline-block max-w-full break-all text-foreground">
            {session.email}
          </span>
        </p>
      )}
    </>
  );
}
