'use client';

import { Button, Spinner } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

export function RetryButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="mt-3 self-start"
      isPending={isPending}
      variant="secondary"
      onPress={() => startTransition(() => router.refresh())}
    >
      {isPending && <Spinner color="current" size="sm" />}
      {isPending ? 'Повторяем…' : 'Повторить'}
    </Button>
  );
}
