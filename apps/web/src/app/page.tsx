import { Button } from '@heroui/react';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold">Video meetings</h1>
      <div className="flex gap-3">
        <Button>Создать встречу</Button>
        <Button variant="secondary">Войти</Button>
      </div>
    </main>
  );
}
